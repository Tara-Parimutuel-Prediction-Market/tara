import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Market, MarketStatus } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Bet, BetStatus } from "../entities/bet.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { Settlement } from "../entities/settlement.entity";
import { User } from "../entities/user.entity";
import { LMSRService } from "./lmsr.service";

import { SCPMService } from "./scpm.service";
import { PlaceBetDto } from "./markets.service";

// ─── Valid state machine transitions ────────────────────────────────────────
const VALID_TRANSITIONS: Record<MarketStatus, MarketStatus[]> = {
  [MarketStatus.UPCOMING]: [MarketStatus.OPEN, MarketStatus.CANCELLED],
  [MarketStatus.OPEN]: [MarketStatus.CLOSED, MarketStatus.CANCELLED],
  [MarketStatus.CLOSED]: [MarketStatus.RESOLVED, MarketStatus.CANCELLED],
  [MarketStatus.RESOLVED]: [MarketStatus.SETTLED],
  [MarketStatus.SETTLED]: [],
  [MarketStatus.CANCELLED]: [],
};

@Injectable()
export class ParimutuelEngine {
  constructor(
    @InjectRepository(Market) private marketRepo: Repository<Market>,
    @InjectRepository(Outcome) private outcomeRepo: Repository<Outcome>,
    @InjectRepository(Bet) private betRepo: Repository<Bet>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
    private lmsrService: LMSRService,
    private scpmService: SCPMService,
  ) {}

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

  /**
   * SCPM implementation: Fill shares based on limit price
   */
  async placeBetSCPM(
    userId: string,
    market: Market,
    dto: PlaceBetDto,
  ): Promise<Bet> {
    const { outcomeId, maxShares, limitPrice } = dto;
    if (!maxShares || !limitPrice) {
      throw new BadRequestException("SCPM requires maxShares and limitPrice");
    }

    return await this.dataSource.transaction(async (em) => {
      // 1. Refresh market state within transaction
      const currentMarket = await em.findOne(Market, {
        where: { id: market.id },
        relations: ["outcomes"],
      });
      if (!currentMarket) throw new BadRequestException("Market not found");
      if (currentMarket.status !== MarketStatus.OPEN)
        throw new BadRequestException("Market is not open");

      const outcome = currentMarket.outcomes.find((o) => o.id === outcomeId);
      if (!outcome) throw new BadRequestException("Outcome not found");

      // 2. Process SCPM order
      const fill = this.scpmService.processOrder(
        currentMarket.outcomes,
        { outcomeId, maxShares, limitPrice },
        Number(currentMarket.liquidityParam),
      );

      if (fill.sharesFilled <= 0) {
        throw new BadRequestException(
          "Order cannot be filled within limit price",
        );
      }

      // 3. Check user balance
      const user = await em.findOne(User, { where: { id: userId } });
      if (!user) throw new BadRequestException("User not found");
      if (Number(user.balance) < fill.totalCost) {
        throw new BadRequestException("Insufficient balance");
      }

      // 4. Update state
      const balanceBefore = Number(user.balance);
      user.balance = balanceBefore - fill.totalCost;
      await em.save(User, user);

      // Record transaction
      await em.save(
        Transaction,
        em.create(Transaction, {
          type: TransactionType.BET_PLACED,
          amount: -fill.totalCost,
          balanceBefore,
          balanceAfter: Number(user.balance),
          referenceId: market.id,
          note: `SCPM Bet: ${fill.sharesFilled} shares of ${outcome.label} @ max ${limitPrice}`,
          userId,
        }),
      );

      // Update pools & outcome probabilities
      outcome.totalBetAmount = Number(outcome.totalBetAmount) + fill.sharesFilled;
      currentMarket.totalPool = Number(currentMarket.totalPool) + fill.totalCost;

      // Update all outcomes with new probabilities from SCPM fill
      currentMarket.outcomes.forEach((o, i) => {
        o.lmsrProbability = fill.newProbabilities[i];
      });

      await em.save(Outcome, currentMarket.outcomes);
      await em.save(Market, currentMarket);

      // Create bet record
      const bet = em.create(Bet, {
        userId,
        marketId: market.id,
        outcomeId,
        amount: fill.totalCost,
        shares: fill.sharesFilled,
        limitPrice: limitPrice,
        status: BetStatus.PENDING,
        oddsAtPlacement: fill.pricePerShare > 0 ? 1 / fill.pricePerShare : 0,
      });
      return em.save(Bet, bet);
    });
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
      if (Number(user.balance) < amount)
        throw new BadRequestException("Insufficient balance");

      // Deduct balance
      const balanceBefore = Number(user.balance);
      user.balance = balanceBefore - amount;
      await em.save(User, user);

      // Record transaction
      const tx = em.create(Transaction, {
        type: TransactionType.BET_PLACED,
        amount: -amount,
        balanceBefore,
        balanceAfter: Number(user.balance),
        referenceId: marketId,
        note: `Bet on outcome: ${outcome.label}`,
        userId,
      });
      await em.save(Transaction, tx);

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
      return em.save(Bet, bet);
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
    if (market.status !== MarketStatus.CLOSED)
      throw new BadRequestException("Market must be Closed before resolving");

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

    // Settle
    return this.settleMarket(market, winner);
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

          // Credit user
          const user = await em.findOne(User, { where: { id: bet.userId } });
          if (user) {
            const balanceBefore = Number(user.balance);
            user.balance = balanceBefore + payout;
            await em.save(User, user);
            await em.save(
              Transaction,
              em.create(Transaction, {
                type: TransactionType.BET_PAYOUT,
                amount: payout,
                balanceBefore,
                balanceAfter: Number(user.balance),
                referenceId: market.id,
                note: `Won bet on: ${winner.label}`,
                userId: bet.userId,
              }),
            );
          }
        } else if (market.status === MarketStatus.CANCELLED) {
          // Refund on cancellation
          bet.status = BetStatus.REFUNDED;
          const user = await em.findOne(User, { where: { id: bet.userId } });
          if (user) {
            const balanceBefore = Number(user.balance);
            user.balance = balanceBefore + Number(bet.amount);
            await em.save(User, user);
            await em.save(
              Transaction,
              em.create(Transaction, {
                type: TransactionType.REFUND,
                amount: Number(bet.amount),
                balanceBefore,
                balanceAfter: Number(user.balance),
                referenceId: market.id,
                note: "Market cancelled — refund",
                userId: bet.userId,
              }),
            );
          }
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
    const market = await this.marketRepo.findOne({
      where: { id: marketId },
      relations: ["outcomes"],
    });
    if (!market) throw new BadRequestException("Market not found");

    market.status = MarketStatus.CANCELLED;
    await this.marketRepo.save(market);

    const bets = await this.betRepo.find({ where: { marketId } });
    for (const bet of bets) {
      if (bet.status === BetStatus.PENDING) {
        const user = await this.userRepo.findOneBy({ id: bet.userId });
        if (user) {
          const balanceBefore = Number(user.balance);
          user.balance = balanceBefore + Number(bet.amount);
          await this.userRepo.save(user);
          await this.txRepo.save(
            this.txRepo.create({
              type: TransactionType.REFUND,
              amount: Number(bet.amount),
              balanceBefore,
              balanceAfter: Number(user.balance),
              referenceId: marketId,
              note: "Market cancelled — refund",
              userId: bet.userId,
            }),
          );
          bet.status = BetStatus.REFUNDED;
          await this.betRepo.save(bet);
        }
      }
    }
  }
}
