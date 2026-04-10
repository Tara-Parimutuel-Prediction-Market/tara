import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository, DataSource, In } from "typeorm";
import { RedisService } from "../redis/redis.service";
import { Market, MarketStatus } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Position, PositionStatus } from "../entities/position.entity";
import { Payment } from "../entities/payment.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { Settlement } from "../entities/settlement.entity";
import { Dispute } from "../entities/dispute.entity";
import { User } from "../entities/user.entity";
import { LMSRService } from "./lmsr.service";
import { ReputationService } from "./reputation.service";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { DKGatewayService } from "../payment/services/dk-gateway/dk-gateway.service";

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
export class ParimutuelEngine implements OnModuleInit {
  private readonly logger = new Logger(ParimutuelEngine.name);

  onModuleInit() {
    this.logger.log(
      "ParimutuelEngine [v2] initialized with dynamic calculation support",
    );
  }

  constructor(
    @InjectRepository(Market) private marketRepo: Repository<Market>,
    @InjectRepository(Outcome) private outcomeRepo: Repository<Outcome>,
    @InjectRepository(Position) private betRepo: Repository<Position>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,
    private dataSource: DataSource,
    private lmsrService: LMSRService,
    private redis: RedisService,
    private reputationService: ReputationService,
    private telegramSimple: TelegramSimpleService,
    private dkGateway: DKGatewayService,
    private configService: ConfigService,
  ) {}

  private async getCreditsBalance(
    em: { getRepository: Function },
    userId: string,
  ): Promise<number> {
    const { balance } = await em
      .getRepository(Transaction)
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
  async placePosition(
    userId: string,
    marketId: string,
    outcomeId: string,
    amount: number,
  ): Promise<Position> {
    if (amount <= 0)
      throw new BadRequestException("Position amount must be positive");

    // Acquire a distributed Redis lock so concurrent bets on the same market
    // are serialised at the application layer before touching the DB.
    let lockToken: string | null = null;
    let completedPosition: Position | null = null;
    let betMarket: Market | null = null;
    let betOutcome: Outcome | null = null;
    let betUser: User | null = null;
    let balanceAfterBet = 0;

    try {
      lockToken = await this.redis.acquireLockWithRetry(
        `market:${marketId}`,
        10,
        3,
        150,
      );
    } catch (e: any) {
      if (e?.message === "LOCK_CONTENDED") {
        throw new BadRequestException(
          "Market is busy, please try again in a moment",
        );
      }
      // Redis unavailable — proceed without lock (DB pessimistic lock still protects us)
    }

    try {
      completedPosition = await this.dataSource.transaction(async (em) => {
        // Pessimistic write lock ensures only one DB transaction modifies this
        // market's pool at a time, even if the Redis lock is unavailable.
        // 1. Lock the market record (using QueryBuilder to avoid eager joins)
        const market = await em
          .getRepository(Market)
          .createQueryBuilder("m")
          .setLock("pessimistic_write")
          .where("m.id = :marketId", { marketId })
          .getOne();
        if (!market) throw new BadRequestException("Market not found");

        // 2. Fetch outcomes separately
        market.outcomes = await em.find(Outcome, {
          where: { marketId },
          order: { id: "ASC" },
        });

        if (market.status !== MarketStatus.OPEN)
          throw new BadRequestException("Market is not open for betting");

        const outcome = market.outcomes.find((o) => o.id === outcomeId);
        if (!outcome)
          throw new BadRequestException("Outcome not found in this market");

        const user = await em.findOne(User, { where: { id: userId } });
        if (!user) throw new BadRequestException("User not found");

        // Store user reference for notification
        betUser = user;
        betMarket = market;
        betOutcome = outcome;

        const balanceBefore = await this.getCreditsBalance(em, userId);
        this.logger.log(
          `[placePosition] user=${userId} credits=${balanceBefore} betAmount=${amount}`,
        );
        if (balanceBefore < amount)
          throw new BadRequestException("Insufficient balance");

        // Snapshot pre-bet LMSR probabilities BEFORE mutating any pool state.
        // This is the probability at the moment the user formed their belief —
        // required for correct Brier score calibration (Formula 1.5).
        const preBetProbs = this.lmsrService.calculateProbabilities(
          market.outcomes,
          Number(market.liquidityParam) || 1000,
        );
        const outcomeIndex = market.outcomes.findIndex(
          (o) => o.id === outcomeId,
        );
        const predictedProbability =
          outcomeIndex >= 0 ? preBetProbs[outcomeIndex] : null;

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

        // Calculate post-bet LMSR probabilities and update display
        const postBetProbs = this.lmsrService.calculateProbabilities(
          market.outcomes,
          Number(market.liquidityParam) || 1000,
        );

        // Update LMSR probabilities for all outcomes
        for (let i = 0; i < market.outcomes.length; i++) {
          market.outcomes[i].lmsrProbability = postBetProbs[i];
          await em.save(Outcome, market.outcomes[i]);
        }

        await em.save(Market, market);

        // Update lastActiveAt for decay tracking (outside the transaction is fine —
        // worst case it's slightly stale, never wrong)
        await em.update(User, { id: userId }, { lastActiveAt: new Date() });

        // Create bet record
        const bet = em.create(Position, {
          userId,
          marketId,
          outcomeId,
          amount,
          status: PositionStatus.PENDING,
          oddsAtPlacement: outcome.currentOdds,
          predictedProbability,
        });
        const savedPosition = await em.save(Position, bet);

        await em.save(
          Transaction,
          em.create(Transaction, {
            type: TransactionType.POSITION_OPENED,
            amount: -amount,
            balanceBefore,
            balanceAfter: balanceBefore - amount,
            positionId: savedPosition.id,
            userId,
            note: `Position on outcome: ${outcome.label}`,
          }),
        );

        // Store balance after bet for notification
        balanceAfterBet = balanceBefore - amount;

        return savedPosition;
      });

      // Send Telegram notification after successful bet placement
      if (completedPosition && betUser && betMarket && betOutcome) {
        this.sendBetPlacementNotification(
          betUser,
          betMarket,
          betOutcome,
          amount,
          balanceAfterBet,
        ).catch((err: any) => {
          this.logger.error(
            `Failed to send bet placement notification: ${err.message}`,
          );
        });
      }

      return completedPosition!;
    } catch (err) {
      throw err;
    } finally {
      if (lockToken)
        await this.redis.releaseLock(`market:${marketId}`, lockToken);
      // Invalidate market cache so subsequent reads reflect updated pool/odds
      await this.redis.del(
        "oro:cache:markets:all",
        `oro:cache:market:${marketId}`,
      );
      // Invalidate balance cache for the bettor
      await this.redis.del(`oro:cache:balance:${userId}`);
    }
  }

  // Transition market state
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

  // Propose resolution: open 24h dispute window
  async proposeResolution(
    marketId: string,
    proposedOutcomeId: string,
  ): Promise<Market> {
    const market = await this.marketRepo.findOne({
      where: { id: marketId },
      relations: ["outcomes"],
    });
    if (!market) throw new BadRequestException("Market not found");
    if (market.status !== MarketStatus.CLOSED)
      throw new BadRequestException(
        "Market must be Closed to propose resolution",
      );

    const proposed = market.outcomes.find((o) => o.id === proposedOutcomeId);
    if (!proposed)
      throw new BadRequestException("Proposed outcome not in this market");

    market.proposedOutcomeId = proposedOutcomeId;
    market.disputeDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    market.status = MarketStatus.RESOLVING;
    return this.marketRepo.save(market);
  }

  // Resolve market: mark winner & trigger settlement
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
      throw new BadRequestException(
        "Market must be in Resolving state before final resolution",
      );

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

    // Settle dispute bonds — returns slashed bond pool (0 if dispute upheld)
    const slashedBondPool = await this.settleDisputeBonds(
      marketId,
      winningOutcomeId,
      market.proposedOutcomeId,
    );

    // Settle — winning bettors get 95% of any slashed bonds on top of normal payout
    const settlement = await this.settleMarket(market, winner, slashedBondPool);

    // Bust balance cache for every bettor so the TMA reflects payouts immediately
    const allBets = await this.betRepo.find({ where: { marketId } });
    const uniqueUserIds = [...new Set(allBets.map((b) => b.userId))];
    await Promise.all(
      uniqueUserIds.map((uid) => this.redis.del(`oro:cache:balance:${uid}`)),
    );

    // Push real BTN from merchant → winners' DK accounts — fire and forget
    this.dispatchDkPayouts(
      market.id,
      winner.id,
      winner.label,
      settlement,
    ).catch((err: Error) =>
      this.logger.warn(
        `[DK Payout] Dispatch failed for market ${marketId}: ${err.message}`,
      ),
    );

    // Recalculate reputation + send individual result DMs — fire and forget
    this.sendSettlementNotifications(market, winner, settlement).catch((err) =>
      this.logger.warn(
        `[Notify] Settlement notifications failed for market ${marketId}: ${err.message}`,
      ),
    );

    return settlement;
  }

  /**
   * Settle dispute bonds after final resolution.
   *
   * - If the final winner matches the proposed outcome → disputants were WRONG:
   *     bonds are slashed (no refund). Returns the total slashed pool so 95%
   *     can be redistributed to winning bettors (5% is the platform fee).
   *
   * - If the final winner differs from the proposed outcome → disputants were RIGHT:
   *     bonds are fully returned via a DISPUTE_REFUND transaction.
   *     Returns 0 (no slashed pool to distribute).
   *
   * In both cases `bondRefunded` is set to `true` to mark the record as processed.
   */
  private async settleDisputeBonds(
    marketId: string,
    winningOutcomeId: string,
    proposedOutcomeId: string | null | undefined,
  ): Promise<number> {
    const disputes = await this.disputeRepo.find({
      where: { marketId, bondRefunded: false },
    });

    if (disputes.length === 0) return 0;

    // Dispute is upheld when the admin's final call differs from the proposal
    const disputeUpheld =
      proposedOutcomeId && winningOutcomeId !== proposedOutcomeId;

    let slashedPool = 0;

    for (const dispute of disputes) {
      await this.dataSource.transaction(async (em) => {
        if (disputeUpheld) {
          // Disputant was CORRECT — return bond (credits path only;
          // DK Bank path bonds were external payments, not credited)
          if (!dispute.bondPaymentId) {
            const balanceBefore = await this.getCreditsBalance(em, dispute.userId);
            await em.save(
              Transaction,
              em.create(Transaction, {
                type: TransactionType.DISPUTE_REFUND,
                amount: Number(dispute.bondAmount),
                balanceBefore,
                balanceAfter: balanceBefore + Number(dispute.bondAmount),
                userId: dispute.userId,
                note: "Dispute upheld — bond returned",
              }),
            );
          }
        } else {
          // Disputant was WRONG — bond slashed, no refund
          slashedPool += Number(dispute.bondAmount);
          this.logger.log(
            `[Dispute] Bond slashed for user ${dispute.userId}: Nu ${dispute.bondAmount} (proposal confirmed)`,
          );
        }
        // Mark processed regardless of outcome
        dispute.bondRefunded = true;
        await em.save(Dispute, dispute);
      });
    }

    if (slashedPool > 0) {
      const platformFee = slashedPool * 0.05;
      this.logger.log(
        `[Dispute] Total slashed: Nu ${slashedPool} | Platform fee (5%): Nu ${platformFee.toFixed(2)} | To winning bettors (95%): Nu ${(slashedPool * 0.95).toFixed(2)}`,
      );
    }

    return slashedPool;
  }

  /**
   * After settlement, push real BTN from the Oro merchant DK account to
   * each winner's DK Bank account (if they have one linked).
   *
   * This runs fire-and-forget after the ledger has already been updated,
   * so a DK API failure does NOT roll back the in-app credit.  Errors are
   * logged so they can be investigated and retried manually if needed.
   *
   * Bypass: set DK_STAGING_PAYOUT_BYPASS=true in .env to skip real DK calls
   * (required in staging because /v1/fund_transfer returns 404 there).
   */
  private async dispatchDkPayouts(
    marketId: string,
    winningOutcomeId: string,
    outcomeLabel: string,
    settlement: Settlement,
  ): Promise<void> {
    const bypass =
      this.configService.get<string>("DK_STAGING_PAYOUT_BYPASS") === "true";

    if (bypass) {
      this.logger.log(
        `[DK Payout] STAGING BYPASS — skipping real DK transfers for market ${marketId} (${settlement.winningPositions} winner(s), pool BTN ${settlement.payoutPool})`,
      );
      return;
    }

    // Fetch all winning positions with their users
    const winningBets = await this.betRepo.find({
      where: {
        marketId,
        outcomeId: winningOutcomeId,
        status: PositionStatus.WON,
      },
      relations: ["user"],
    });

    for (const bet of winningBets) {
      const user: User = (bet as any).user;
      if (!user?.dkAccountNumber) {
        this.logger.warn(
          `[DK Payout] User ${bet.userId} has no DK account linked — skipping DK transfer for position ${bet.id} (BTN ${bet.payout})`,
        );
        continue;
      }

      const payout = Number(bet.payout ?? 0);
      if (payout <= 0) continue;

      try {
        const result = await this.dkGateway.transferToAccount({
          accountNumber: user.dkAccountNumber,
          accountName: user.dkAccountName ?? undefined,
          amount: payout,
          reference: bet.id,
          description: `Oro payout: ${outcomeLabel}`,
        });

        if (result.status === "SUCCESS") {
          this.logger.log(
            `[DK Payout] ✅ BTN ${payout} → ${user.dkAccountNumber} (user ${bet.userId}) txnId=${result.txnId}`,
          );
        } else {
          this.logger.error(
            `[DK Payout] ❌ Transfer FAILED for user ${bet.userId} (BTN ${payout}): ${result.statusDesc}`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `[DK Payout] ❌ Exception for user ${bet.userId} position ${bet.id}: ${err?.message}`,
        );
      }
    }
  }

  // Settlement: distribute payouts
  private async settleMarket(
    market: Market,
    winner: Outcome,
    slashedBondPool = 0,
  ): Promise<Settlement> {
    return await this.dataSource.transaction(async (em) => {
      const totalPool = Number(market.totalPool);
      const houseAmount = totalPool * (Number(market.houseEdgePct) / 100);
      // 95% of any slashed dispute bonds flows to winning bettors; 5% is platform fee
      const disputeBonus = slashedBondPool * 0.95;
      const payoutPool = totalPool - houseAmount + disputeBonus;

      const winnerPool = Number(winner.totalBetAmount);
      const bets = await em.find(Position, { where: { marketId: market.id } });

      let totalPaidOut = 0;
      let winningPositions = 0;

      for (const bet of bets) {
        if (bet.outcomeId === winner.id) {
          // Payout proportional to their share of winner pool
          const share = winnerPool > 0 ? Number(bet.amount) / winnerPool : 0;
          const payout = parseFloat((payoutPool * share).toFixed(2));
          bet.payout = payout;
          bet.status = PositionStatus.WON;
          totalPaidOut += payout;
          winningPositions++;

          const balanceBefore = await this.getCreditsBalance(em, bet.userId);
          await em.save(
            Transaction,
            em.create(Transaction, {
              type: TransactionType.POSITION_PAYOUT,
              amount: payout,
              balanceBefore,
              balanceAfter: balanceBefore + payout,
              positionId: bet.id,
              userId: bet.userId,
              note: `Payout for winning bet on: ${winner.label}`,
            }),
          );
        } else if (market.status === MarketStatus.CANCELLED) {
          // Refund on cancellation via ledger entry
          bet.status = PositionStatus.REFUNDED;
          const balanceBefore = await this.getCreditsBalance(em, bet.userId);
          await em.save(
            Transaction,
            em.create(Transaction, {
              type: TransactionType.REFUND,
              amount: Number(bet.amount),
              balanceBefore,
              balanceAfter: balanceBefore + Number(bet.amount),
              positionId: bet.id,
              userId: bet.userId,
              note: "Market cancelled — refund",
            }),
          );
        } else {
          bet.status = PositionStatus.LOST;
        }
        await em.save(Position, bet);
      }

      market.status = MarketStatus.SETTLED;
      await em.save(Market, market);

      const settlement = em.create(Settlement, {
        marketId: market.id,
        winningOutcomeId: winner.id,
        totalPositions: bets.length,
        winningPositions,
        totalPool,
        houseAmount,
        payoutPool,
        totalPaidOut,
      });
      return em.save(Settlement, settlement);
    });
  }

  // ── Bet placement notification ─────────────────────────────────────────────

  private async sendBetPlacementNotification(
    user: User,
    market: Market,
    outcome: Outcome,
    amount: number,
    balanceAfter: number,
  ): Promise<void> {
    if (!user.telegramId) {
      this.logger.debug(
        `[BetNotification] User ${user.id} has no Telegram ID, skipping notification`,
      );
      return;
    }

    const chatId = parseInt(user.telegramId, 10);
    if (isNaN(chatId)) {
      this.logger.warn(
        `[BetNotification] Invalid Telegram ID for user ${user.id}: ${user.telegramId}`,
      );
      return;
    }

    const message = `
✅ <b>Bet Placed Successfully!</b>

📊 <b>Market:</b> ${market.title}
🎯 <b>Outcome:</b> ${outcome.label}
💰 <b>Amount:</b> Nu ${amount.toLocaleString()}

💳 <b>New Balance:</b> Nu ${balanceAfter.toLocaleString()}

Good luck! 🍀
    `.trim();

    try {
      await this.telegramSimple.sendMessage(chatId, message);
      this.logger.log(
        `[BetNotification] Sent to user ${user.id} for bet of Nu ${amount}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[BetNotification] Failed to send to user ${user.id}: ${error.message}`,
      );
    }
  }

  // ── Post-settlement: reputation recalc + individual DM notifications ────────

  private async sendSettlementNotifications(
    market: Market,
    winner: Outcome,
    settlement: Settlement,
  ): Promise<void> {
    // 1. Snapshot tiers before recalculation so we can detect upgrades
    const bets = await this.betRepo.find({
      where: { marketId: market.id },
      relations: ["user"],
    });

    const tiersBefore: Record<string, string> = {};
    for (const bet of bets) {
      if (bet.user)
        tiersBefore[bet.userId] = bet.user.reputationTier ?? "newcomer";
    }

    // 2. Recalculate reputation for all bettors
    await this.reputationService.recalculateForMarket(market.id);

    // 2b. Contrarian badge tracking
    // A bet is "contrarian" if predictedProbability < 0.5 at placement
    // (user bet on the outcome the signal said was less likely)
    for (const bet of bets) {
      if (
        bet.status === PositionStatus.WON ||
        bet.status === PositionStatus.LOST
      ) {
        await this.reputationService
          .recordContrarianOutcome(
            bet.userId,
            (bet as any).predictedProbability != null
              ? Number((bet as any).predictedProbability)
              : null,
            bet.status === PositionStatus.WON,
          )
          .catch(() => {});
      }
    }

    // 3. Reload updated users for tier-change detection
    const userIds = [...new Set(bets.map((b) => b.userId))];
    const users = await this.dataSource
      .getRepository(User)
      .findBy({ id: In(userIds) });
    const userMap: Record<string, User> = {};
    for (const u of users) userMap[u.id] = u;

    // 4. Send ONE DM per user (not per position — a user may hold multiple

    const payoutPool = settlement.payoutPool;
    const winnerPool = Number(winner.totalBetAmount);

    // Group all bets by userId so we can aggregate across multiple positions.
    const betsByUser: Record<string, typeof bets> = {};
    for (const bet of bets) {
      if (!betsByUser[bet.userId]) betsByUser[bet.userId] = [];
      betsByUser[bet.userId].push(bet);
    }

    for (const userId of Object.keys(betsByUser)) {
      const userBets = betsByUser[userId];
      const user = userMap[userId];
      if (!user?.telegramId) continue;

      const chatId = Number(user.telegramId);
      const firstName = user.firstName?.trim() || "there";
      const tierNow = user.reputationTier ?? "newcomer";
      const tierBefore = tiersBefore[userId] ?? "newcomer";
      const totalPredictions = user.totalPredictions ?? 0;
      const accuracy =
        totalPredictions > 0 && user.reputationScore != null
          ? `${Math.round(user.reputationScore * 100)}%`
          : null;

      const tierOrder = ["newcomer", "regular", "reliable", "expert"];
      const tierUpgraded =
        tierOrder.indexOf(tierNow) > tierOrder.indexOf(tierBefore);

      // A user wins if ANY of their positions won; they lose only if ALL lost.
      const hasWon = userBets.some((b) => b.status === PositionStatus.WON);

      if (hasWon) {
        // Aggregate total stake and payout across all winning positions for this user.
        let totalStake = 0;
        let totalPayout = 0;
        for (const bet of userBets) {
          if (bet.status === PositionStatus.WON) {
            const share = winnerPool > 0 ? Number(bet.amount) / winnerPool : 0;
            const payout = parseFloat((payoutPool * share).toFixed(2));
            totalStake += Number(bet.amount);
            totalPayout += payout;
          }
        }
        const profit = (totalPayout - totalStake).toFixed(2);

        let msg =
          `✅ <b>You predicted correctly!</b>\n\n` +
          `📊 ${market.title}\n` +
          `🎯 Your pick: <b>${winner.label}</b>\n` +
          `💰 Payout: <b>Nu ${totalPayout.toLocaleString()}</b> (+Nu ${profit})\n`;

        if (accuracy)
          msg += `⭐ Accuracy: <b>${accuracy}</b> over ${totalPredictions} predictions\n`;
        if (tierUpgraded)
          msg += `\n🏆 <b>Tier upgrade! You are now ${tierNow.charAt(0).toUpperCase() + tierNow.slice(1)}.</b>`;

        // Contrarian badge notification
        const updatedUser = await this.dataSource.getRepository(User).findOne({
          where: { id: user.id },
          select: ["contrarianBadge", "contrarianWins", "contrarianAttempts"],
        });
        const contrarianBadge = updatedUser?.contrarianBadge;
        const prevBadge = user.contrarianBadge ?? null;
        if (contrarianBadge && contrarianBadge !== prevBadge) {
          const badgeEmoji =
            contrarianBadge === "gold"
              ? "🥇"
              : contrarianBadge === "silver"
                ? "🥈"
                : "🥉";
          msg += `\n\n${badgeEmoji} <b>Contrarian ${contrarianBadge.charAt(0).toUpperCase() + contrarianBadge.slice(1)} badge earned!</b> You went against the crowd and won. ${updatedUser?.contrarianWins} contrarian wins so far.`;
        }

        await this.telegramSimple.sendMessage(chatId, msg).catch(() => {});

        // Streak update
        const currentStreak = (user.telegramStreak ?? 0) + 1;
        await this.dataSource
          .getRepository(User)
          .update(user.id, { telegramStreak: currentStreak });
        if (currentStreak >= 3) {
          await this.telegramSimple
            .sendMessage(
              chatId,
              `🔥 <b>${currentStreak} correct in a row, ${firstName}!</b> You're on fire.`,
            )
            .catch(() => {});
        }
      } else {
        // All of this user's positions lost — send a single loss DM.
        const outcome = market.outcomes.find(
          (o) => o.id === userBets[0].outcomeId,
        );

        let msg =
          `🙂‍↕️<b>Not this time.</b>\n\n` +
          `📊 ${market.title}\n` +
          `🎯 Your pick: ${outcome?.label ?? "unknown"} · Winner: <b>${winner.label}</b>\n`;

        if (accuracy)
          msg += `⭐ Accuracy: <b>${accuracy}</b> over ${totalPredictions} predictions\n`;
        msg += `\n💡 Every prediction builds your reputation. Keep going.`;

        await this.telegramSimple.sendMessage(chatId, msg).catch(() => {});
        await this.dataSource
          .getRepository(User)
          .update(user.id, { telegramStreak: 0 })
          .catch(() => {});
      }
    }

    this.logger.log(
      `[Notify] Settlement DMs sent for market ${market.id} to ${Object.keys(betsByUser).length} bettors (${bets.length} positions total)`,
    );
  }

  // Cancel market: refund all bets
  async cancelMarket(marketId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const market = await em.findOne(Market, {
        where: { id: marketId },
        relations: ["outcomes"],
      });
      if (!market) throw new BadRequestException("Market not found");

      market.status = MarketStatus.CANCELLED;
      await em.save(Market, market);

      const bets = await em.find(Position, { where: { marketId } });
      for (const bet of bets) {
        if (bet.status === PositionStatus.PENDING) {
          const balanceBefore = await this.getCreditsBalance(em, bet.userId);
          await em.save(
            Transaction,
            em.create(Transaction, {
              type: TransactionType.REFUND,
              amount: Number(bet.amount),
              balanceBefore,
              balanceAfter: balanceBefore + Number(bet.amount),
              positionId: bet.id,
              userId: bet.userId,
              note: "Market cancelled — refund",
            }),
          );
          bet.status = PositionStatus.REFUNDED;
          await em.save(Position, bet);
        }
      }
    });
  }
}
