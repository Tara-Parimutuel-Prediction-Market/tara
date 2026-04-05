import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { Bet, BetStatus } from "../entities/bet.entity";
import { Market } from "../entities/market.entity";

/**
 * ReputationService
 *
 * Calculates and stores per-user prediction accuracy scores after each
 * market settles. Scores are confidence-adjusted so users with few
 * predictions don't appear falsely accurate.
 *
 * Score formula:
 *   raw       = correctPredictions / totalPredictions
 *   confidence = min(totalPredictions / CONFIDENCE_THRESHOLD, 1.0)
 *   adjusted   = raw * confidence + 0.5 * (1 - confidence)
 *
 * A newcomer with 2/2 correct gets ~0.53 (barely above neutral).
 * A veteran with 80/100 correct gets 0.80 (full signal).
 *
 * Tiers:
 *   newcomer  — fewer than 10 resolved predictions
 *   regular   — 10–49 predictions, any accuracy
 *   reliable  — 50+ predictions, accuracy >= 65%
 *   expert    — 100+ predictions, accuracy >= 75%
 */
@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  /** Predictions needed before score reaches full confidence. */
  private readonly CONFIDENCE_THRESHOLD = 30;

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Bet)  private readonly betRepo:  Repository<Bet>,
    @InjectRepository(Market) private readonly marketRepo: Repository<Market>,
  ) {}

  /**
   * Called after every market settlement.
   * Recalculates reputation scores for all users who had a bet in this market.
   */
  async recalculateForMarket(marketId: string): Promise<void> {
    const market = await this.marketRepo.findOneBy({ id: marketId });
    if (!market) return;

    // Fetch all resolved bets for this market (won or lost only — skip refunded)
    const bets = await this.betRepo.find({
      where: [
        { marketId, status: BetStatus.WON },
        { marketId, status: BetStatus.LOST },
      ],
    });

    if (bets.length === 0) return;

    // Collect unique user IDs
    const userIds = [...new Set(bets.map((b) => b.userId))];

    for (const userId of userIds) {
      await this.recalculateForUser(userId, market.category);
    }

    this.logger.log(
      `[Reputation] Recalculated scores for ${userIds.length} users after market ${marketId} settled`,
    );
  }

  /**
   * Recalculates the full reputation score for a single user across all
   * their resolved predictions.
   */
  async recalculateForUser(userId: string, _triggeredByCategory?: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) return;

    // Fetch ALL resolved bets for this user across all markets
    const allBets = await this.betRepo
      .createQueryBuilder("b")
      .leftJoinAndSelect("b.market", "m")
      .where("b.userId = :userId", { userId })
      .andWhere("b.status IN (:...statuses)", {
        statuses: [BetStatus.WON, BetStatus.LOST],
      })
      .getMany();

    const totalPredictions  = allBets.length;
    const correctPredictions = allBets.filter((b) => b.status === BetStatus.WON).length;

    // ── Per-category breakdown ───────────────────────────────────────────────
    const categoryScores: Record<string, { correct: number; total: number }> = {};
    for (const bet of allBets) {
      const cat = (bet.market as any)?.category ?? "other";
      if (!categoryScores[cat]) categoryScores[cat] = { correct: 0, total: 0 };
      categoryScores[cat].total += 1;
      if (bet.status === BetStatus.WON) categoryScores[cat].correct += 1;
    }

    // ── Confidence-adjusted overall score ────────────────────────────────────
    const reputationScore = totalPredictions === 0
      ? null
      : this.adjustedScore(correctPredictions, totalPredictions);

    // ── Tier ─────────────────────────────────────────────────────────────────
    const reputationTier = this.calcTier(totalPredictions, correctPredictions);

    await this.userRepo.update(userId, {
      totalPredictions,
      correctPredictions,
      reputationScore,
      reputationTier,
      categoryScores: Object.keys(categoryScores).length > 0 ? categoryScores : null,
    });

    this.logger.debug(
      `[Reputation] user=${userId} total=${totalPredictions} correct=${correctPredictions} ` +
      `score=${reputationScore?.toFixed(4) ?? "null"} tier=${reputationTier}`,
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Returns confidence-adjusted accuracy score in range 0.0–1.0.
   * Pulled toward 0.5 (neutral) when prediction count is low.
   */
  adjustedScore(correct: number, total: number): number {
    if (total === 0) return 0.5;
    const raw        = correct / total;
    const confidence = Math.min(total / this.CONFIDENCE_THRESHOLD, 1.0);
    return parseFloat((raw * confidence + 0.5 * (1 - confidence)).toFixed(4));
  }

  /**
   * Returns the display tier based on volume and accuracy.
   *
   *   newcomer  < 10 predictions
   *   regular   10–49 predictions
   *   reliable  50+ predictions AND accuracy >= 65%
   *   expert    100+ predictions AND accuracy >= 75%
   */
  calcTier(total: number, correct: number): string {
    if (total < 10)  return "newcomer";
    const accuracy = correct / total;
    if (total >= 100 && accuracy >= 0.75) return "expert";
    if (total >= 50  && accuracy >= 0.65) return "reliable";
    return "regular";
  }

  /**
   * Computes accuracy-weighted probability signal per outcome for a market.
   * Returns a map of outcomeId → probability (0–1), or empty map if no data.
   *
   * Formula:
   *   weight_i = Σ user.reputationScore for each bettor on outcome i
   *   signal_i = weight_i / Σ weight_all
   *
   * Each bettor contributes one vote weighted by their accuracy — bet size
   * is intentionally ignored so a high-reputation user with a small bet
   * counts the same as one with a large bet.
   * Users with no score yet default to 0.5 (neutral).
   * Returns empty object when fewer than 3 unique bettors exist (not enough signal).
   */
  async computeMarketSignal(
    marketId: string,
    outcomeIds: string[],
  ): Promise<Record<string, number>> {
    const rows = await this.betRepo
      .createQueryBuilder("b")
      .leftJoin("b.user", "u")
      .select("b.outcomeId", "outcomeId")
      .addSelect("u.reputationScore", "reputationScore")
      .addSelect("b.userId", "userId")
      .where("b.marketId = :marketId", { marketId })
      .andWhere("b.status IN (:...statuses)", {
        statuses: [BetStatus.PENDING, BetStatus.WON, BetStatus.LOST],
      })
      .getRawMany();

    // Need at least 3 unique bettors for a meaningful signal
    const uniqueBettors = new Set(rows.map((r) => r.userId)).size;
    if (uniqueBettors < 3) return {};

    const weightedSums: Record<string, number> = {};
    let totalWeight = 0;

    for (const row of rows) {
      // Pure accuracy signal: what fraction of accurate predictors picked each outcome?
      const weight = Number(row.reputationScore ?? 0.5); // not multiplied by amount
      weightedSums[row.outcomeId] = (weightedSums[row.outcomeId] || 0) + weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return {};

    const signal: Record<string, number> = {};
    for (const id of outcomeIds) {
      signal[id] = parseFloat(
        ((weightedSums[id] || 0) / totalWeight).toFixed(4),
      );
    }
    return signal;
  }

  /**
   * Returns the best reputation score for a specific category.
   * Falls back to overall score if category has fewer than 5 predictions.
   */
  scoreForCategory(user: User, category: string): number {
    const cat = user.categoryScores?.[category];
    if (cat && cat.total >= 5) {
      return this.adjustedScore(cat.correct, cat.total);
    }
    return user.reputationScore ?? 0.5;
  }
}
