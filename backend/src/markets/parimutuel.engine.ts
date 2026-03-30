import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Market, MarketStatus } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Bet, BetStatus } from "../entities/bet.entity";
import { Payment } from "../entities/payment.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { Settlement } from "../entities/settlement.entity";
import { Dispute } from "../entities/dispute.entity";
import { User } from "../entities/user.entity";
import { LMSRService } from "./lmsr.service";


// ─── Valid state machine transitions ────────────────────────────────────────
const VALID_TRANSITIONS: Record<MarketStatus, MarketStatus[]> = {
  [MarketStatus.UPCOMING]: [MarketStatus.OPEN, MarketStatus.CANCELLED],
  [MarketStatus.OPEN]: [MarketStatus.CLOSED, MarketStatus.CANCELLED],
  [MarketStatus.CLOSED]: [MarketStatus.RESOLVING, MarketStatus.CANCELLED],
  [MarketStatus.RESOLVING]: [MarketStatus.CANCELLED],
  [MarketStatus.RESOLVED]: [MarketStatus.SETTLED],
  [MarketStatus.SETTLED]: [],
  [MarketStatus.CANCELLED]: [],
};

@Injectable()
export class ParimutuelEngine {
  private readonly logger = new Logger(ParimutuelEngine.name);

  constructor(
    @InjectRepository(Market) private marketRepo: Repository<Market>,
    @InjectRepository(Outcome) private outcomeRepo: Repository<Outcome>,
    @InjectRepository(Bet) private betRepo: Repository<Bet>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,
    private dataSource: DataSource,
    private lmsrService: LMSRService,
  ) {}

  private async getCreditsBalance(em: { getRepository: Function }, userId: string): Promise<number> {
    const { balance } = await em.getRepository(Transaction)
      .createQueryBuilder("t")
      .select("COALESCE(SUM(t.amount), 0)", "balance")
      .where("t.userId = :userId", { userId })
      .getRawOne();
    return Number(balance);
  }

  // ── Odds calculation ───────────────────────────────────────────────────────
  calcOdds(
    totalPool: number,
    houseEdgePct: number,
    outcomePool: number,
  ): number {
    if (outcomePool === 0) return 0;
    const payoutPool = totalPool * (1 - houseEdgePct / 100);
    return payoutPool / outcomePool;
  }

  // ── Accept a bet ──────────────────────────────────────────────────────────
  async placeBet(
    userId: string,
    marketId: string,
    outcomeId: string,
    amount: number,
  ): Promise<Bet> {
    if (amount <= 0)
      throw new BadRequestException("Bet amount must be positive");

    return await this.dataSource.transaction(async (em) => {
      const market = await em.findOne(Market, {
        where: { id: marketId },
        relations: ["outcomes"],
      });
      if (!market) throw new BadRequestException("Market not found");
      if (market.status !== MarketStatus.OPEN)
        throw new BadRequestException("Market is not open for betting");

      const outcome = market.outcomes.find((o) => o.id === outcomeId);
      if (!outcome)
        throw new BadRequestException("Outcome not found in this market");

      const user = await em.findOne(User, { where: { id: userId } });
      if (!user) throw new BadRequestException("User not found");
      const balanceBefore = await this.getCreditsBalance(em, userId);
      this.logger.log(`[placeBet] user=${userId} credits=${balanceBefore} betAmount=${amount}`);
      if (balanceBefore < amount)
        throw new BadRequestException("Insufficient balance");

      // Update outcome pool
      outcome.totalBetAmount = Number(outcome.totalBetAmount) + amount;

      // Update market total pool
      market.totalPool = Number(market.totalPool) + amount;

      // Recalculate odds for all outcomes (parimutuel - for settlement)
      for (const o of market.outcomes) {
        o.currentOdds = this.calcOdds(
          Number(market.totalPool),
          Number(market.houseEdgePct),
          Number(o.totalBetAmount),
        );
        await em.save(Outcome, o);
      }

      // Calculate LMSR probabilities (for display)
      const lmsrProbs = this.lmsrService.calculateProbabilities(
        market.outcomes,
        1000, // Liquidity parameter in BTN
      );

      // Update LMSR probabilities for all outcomes
      for (let i = 0; i < market.outcomes.length; i++) {
        market.outcomes[i].lmsrProbability = lmsrProbs[i];
        await em.save(Outcome, market.outcomes[i]);
      }

      await em.save(Market, market);

      // Create bet record
      const bet = em.create(Bet, {
        userId,
        marketId,
        outcomeId,
        amount,
        status: BetStatus.PENDING,
        oddsAtPlacement: outcome.currentOdds,
      });
      const savedBet = await em.save(Bet, bet);

      await em.save(Transaction, em.create(Transaction, {
        type: TransactionType.BET_PLACED,
        amount: -amount,
        balanceBefore,
        balanceAfter: balanceBefore - amount,
        betId: savedBet.id,
        userId,
        note: `Bet on outcome: ${outcome.label}`,
      }));

      return savedBet;
    });
  }

  // ── Transition market state ───────────────────────────────────────────────
  async transitionMarket(marketId: string, to: MarketStatus): Promise<Market> {
    const market = await this.marketRepo.findOneBy({ id: marketId });
    if (!market) throw new BadRequestException("Market not found");

    const allowed = VALID_TRANSITIONS[market.status];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot transition from ${market.status} → ${to}. Allowed: ${allowed.join(", ") || "none"}`,
      );
    }
    market.status = to;
    return this.marketRepo.save(market);
  }

  // ── Propose resolution: open 24h dispute window ──────────────────────────
  async proposeResolution(marketId: string, proposedOutcomeId: string): Promise<Market> {
    const market = await this.marketRepo.findOne({
      where: { id: marketId },
      relations: ["outcomes"],
    });
    if (!market) throw new BadRequestException("Market not found");
    if (market.status !== MarketStatus.CLOSED)
      throw new BadRequestException("Market must be Closed to propose resolution");

    const proposed = market.outcomes.find((o) => o.id === proposedOutcomeId);
    if (!proposed) throw new BadRequestException("Proposed outcome not in this market");

    market.proposedOutcomeId = proposedOutcomeId;
    market.disputeDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    market.status = MarketStatus.RESOLVING;
    return this.marketRepo.save(market);
  }

  // ── Resolve market: mark winner & trigger settlement ─────────────────────
  async resolveMarket(
    marketId: string,
    winningOutcomeId: string,
  ): Promise<Settlement> {
    const market = await this.marketRepo.findOne({
      where: { id: marketId },
      relations: ["outcomes"],
    });
    if (!market) throw new BadRequestException("Market not found");
    if (market.status !== MarketStatus.RESOLVING)
      throw new BadRequestException("Market must be in Resolving state before final resolution");

    const winner = market.outcomes.find((o) => o.id === winningOutcomeId);
    if (!winner)
      throw new BadRequestException("Winning outcome not in this market");

    // Mark winner
    winner.isWinner = true;
    await this.outcomeRepo.save(winner);
    market.resolvedOutcomeId = winningOutcomeId;
    market.resolvedAt = new Date();
    market.status = MarketStatus.RESOLVED;
    await this.marketRepo.save(market);

    // Refund dispute bonds
    await this.refundDisputeBonds(marketId);

    // Settle
    return this.settleMarket(market, winner);
  }

  // ── Refund dispute bonds ──────────────────────────────────────────────────
  private async refundDisputeBonds(marketId: string): Promise<void> {
    const disputes = await this.disputeRepo.find({
      where: { marketId, bondRefunded: false },
    });
    for (const dispute of disputes) {
      await this.dataSource.transaction(async (em) => {
        const balanceBefore = await this.getCreditsBalance(em, dispute.userId);
        await em.save(Transaction, em.create(Transaction, {
          type: TransactionType.DISPUTE_REFUND,
          amount: Number(dispute.bondAmount),
          balanceBefore,
          balanceAfter: balanceBefore + Number(dispute.bondAmount),
          userId: dispute.userId,
          note: 'Dispute bond refund after market resolution',
        }));
        dispute.bondRefunded = true;
        await em.save(Dispute, dispute);
      });
    }
  }

  // ── Settlement: distribute payouts ───────────────────────────────────────
  private async settleMarket(
    market: Market,
    winner: Outcome,
  ): Promise<Settlement> {
    return await this.dataSource.transaction(async (em) => {
      const totalPool = Number(market.totalPool);
      const houseAmount = totalPool * (Number(market.houseEdgePct) / 100);
      const payoutPool = totalPool - houseAmount;

      const winnerPool = Number(winner.totalBetAmount);
      const bets = await em.find(Bet, { where: { marketId: market.id } });

      let totalPaidOut = 0;
      let winningBets = 0;

      for (const bet of bets) {
        if (bet.outcomeId === winner.id) {
          // Payout proportional to their share of winner pool
          const share = winnerPool > 0 ? Number(bet.amount) / winnerPool : 0;
          const payout = parseFloat((payoutPool * share).toFixed(2));
          bet.payout = payout;
          bet.status = BetStatus.WON;
          totalPaidOut += payout;
          winningBets++;

          const balanceBefore = await this.getCreditsBalance(em, bet.userId);
          await em.save(Transaction, em.create(Transaction, {
            type: TransactionType.BET_PAYOUT,
            amount: payout,
            balanceBefore,
            balanceAfter: balanceBefore + payout,
            betId: bet.id,
            userId: bet.userId,
            note: `Payout for winning bet on: ${winner.label}`,
          }));
        } else if (market.status === MarketStatus.CANCELLED) {
          // Refund on cancellation via ledger entry
          bet.status = BetStatus.REFUNDED;
          const balanceBefore = await this.getCreditsBalance(em, bet.userId);
          await em.save(Transaction, em.create(Transaction, {
            type: TransactionType.REFUND,
            amount: Number(bet.amount),
            balanceBefore,
            balanceAfter: balanceBefore + Number(bet.amount),
            betId: bet.id,
            userId: bet.userId,
            note: 'Market cancelled — refund',
          }));
        } else {
          bet.status = BetStatus.LOST;
        }
        await em.save(Bet, bet);
      }

      market.status = MarketStatus.SETTLED;
      await em.save(Market, market);

      const settlement = em.create(Settlement, {
        marketId: market.id,
        winningOutcomeId: winner.id,
        totalBets: bets.length,
        winningBets,
        totalPool,
        houseAmount,
        payoutPool,
        totalPaidOut,
      });
      return em.save(Settlement, settlement);
    });
  }

  // ── Cancel market: refund all bets ───────────────────────────────────────
  async cancelMarket(marketId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const market = await em.findOne(Market, {
        where: { id: marketId },
        relations: ["outcomes"],
      });
      if (!market) throw new BadRequestException("Market not found");

      market.status = MarketStatus.CANCELLED;
      await em.save(Market, market);

      const bets = await em.find(Bet, { where: { marketId } });
      for (const bet of bets) {
        if (bet.status === BetStatus.PENDING) {
          const balanceBefore = await this.getCreditsBalance(em, bet.userId);
          await em.save(Transaction, em.create(Transaction, {
            type: TransactionType.REFUND,
            amount: Number(bet.amount),
            balanceBefore,
            balanceAfter: balanceBefore + Number(bet.amount),
            betId: bet.id,
            userId: bet.userId,
            note: 'Market cancelled — refund',
          }));
          bet.status = BetStatus.REFUNDED;
          await em.save(Bet, bet);
        }
      }
    });
  }
}
