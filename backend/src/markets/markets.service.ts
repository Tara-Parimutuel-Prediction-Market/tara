import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { RedisService } from "../redis/redis.service";
import { CreateMarketDto } from "./dto/create-market.dto";
import { UpdateMarketDto } from "./dto/update-market.dto";
import { OpenPositionDto } from "./dto/open-position.dto";
import { SubmitDisputeDto } from "./dto/submit-dispute.dto";
import {
  Market,
  MarketStatus,
  MarketMechanism,
} from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Dispute } from "../entities/dispute.entity";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../entities/payment.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { Position, PositionStatus } from "../entities/position.entity";
import { User } from "../entities/user.entity";
import { ParimutuelEngine } from "./parimutuel.engine";
import { LMSRService } from "./lmsr.service";
import { ReputationService } from "./reputation.service";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
export { CreateMarketDto } from "./dto/create-market.dto";
export { UpdateMarketDto } from "./dto/update-market.dto";
export { OpenPositionDto } from "./dto/open-position.dto";
export { SubmitDisputeDto } from "./dto/submit-dispute.dto";

@Injectable()
export class MarketsService {
  constructor(
    @InjectRepository(Market) private marketRepo: Repository<Market>,
    @InjectRepository(Outcome) private outcomeRepo: Repository<Outcome>,
    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private engine: ParimutuelEngine,
    private lmsrService: LMSRService,
    private dataSource: DataSource,
    private redis: RedisService,
    private reputationService: ReputationService,
    private telegram: TelegramSimpleService,
  ) {}

  /**
   * Returns the last N position events for the live activity ticker.
   * Each item has enough info to render "Tashi just bet Nu 200 on Yes in <market>"
   * or "Karma won Nu 450 on Germany in <market>".
   *
   * Returns both pending (bets) and won (payouts) positions so the ticker
   * shows a mix of activity.
   */
  async getRecentActivity(limit = 20): Promise<
    {
      type: "bet" | "win";
      userName: string;
      outomeLabel: string;
      marketTitle: string;
      amount: number;
      placedAt: Date;
    }[]
  > {
    const positions = await this.dataSource
      .getRepository(Position)
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.user", "u")
      .leftJoinAndSelect("p.outcome", "o")
      .leftJoinAndSelect("p.market", "m")
      .where("p.status IN (:...statuses)", { statuses: ["pending", "won"] })
      .orderBy("p.placedAt", "DESC")
      .limit(limit)
      .getMany();

    return positions.map((p) => {
      const displayName = p.user?.username
        ? `@${p.user.username}`
        : p.user?.firstName
          ? p.user.firstName
          : "Someone";

      return {
        type: p.status === "won" ? "win" : "bet",
        userName: displayName,
        outomeLabel: p.outcome?.label ?? "an outcome",
        marketTitle: p.market?.title ?? "a market",
        amount: Number(p.status === "won" ? (p.payout ?? p.amount) : p.amount),
        placedAt: p.placedAt,
      };
    });
  }

  private async invalidateMarketCache(marketId?: string): Promise<void> {
    const keys = ["oro:cache:markets:all"];
    if (marketId) keys.push(`oro:cache:market:${marketId}`);
    await this.redis.del(...keys);
  }

  async create(dto: CreateMarketDto): Promise<Market> {
    if (!dto.outcomes || !Array.isArray(dto.outcomes)) {
      throw new Error("Outcomes are required and must be an array");
    }

    try {
      // 1. Create outcome objects and initialize them
      const outcomes = dto.outcomes.map((label) =>
        this.outcomeRepo.create({
          label,
          totalBetAmount: 0,
          currentOdds: 0,
          lmsrProbability: 0,
          isWinner: false,
        }),
      );

      // 2. Calculate initial LMSR probabilities
      const liquidityParam = Number(dto.liquidityParam ?? 1000);
      const initialProbs = this.lmsrService.calculateProbabilities(
        outcomes,
        liquidityParam,
      );
      outcomes.forEach((o, i) => {
        o.lmsrProbability = initialProbs[i];
      });

      // 3. Create market and link outcomes (cascade will handle saving them)
      const market = this.marketRepo.create({
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        resolutionCriteria: dto.resolutionCriteria ?? undefined,
        opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        houseEdgePct: dto.houseEdgePct ?? 8,
        mechanism: MarketMechanism.PARIMUTUEL,
        liquidityParam: liquidityParam,
        outcomes: outcomes,
        totalPool: 0,
        status: MarketStatus.UPCOMING,
        externalMatchId: dto.externalMatchId ?? null,
        externalSource: dto.externalSource ?? null,
        externalMarketType: dto.externalMarketType ?? null,
      });

      const saved = await this.marketRepo.save(market);
      console.log(`✅ Market created successfully: ${saved.id}`);
      await this.invalidateMarketCache();
      const full = await this.findOne(saved.id);
      this.telegram
        .postToChannel(
          `New market: <b>${full.title}</b>\nCloses: ${new Date(full.closesAt).toLocaleString()}\nOutcomes: ${full.outcomes.map((o) => o.label).join(" vs ")}`,
        )
        .catch(() => undefined);
      return full;
    } catch (err) {
      console.error("❌ Error in MarketsService.create:", err);
      throw err;
    }
  }

  async findAll(q?: string): Promise<Market[]> {
    const cacheKey = q
      ? `oro:cache:markets:search:${q.toLowerCase().trim()}`
      : "oro:cache:markets:all";
    const cached = await this.redis.getJson<Market[]>(cacheKey);
    if (cached) return cached;

    const qb = this.marketRepo
      .createQueryBuilder("market")
      .leftJoinAndSelect("market.outcomes", "outcome")
      .orderBy("market.createdAt", "DESC");

    if (q && q.trim()) {
      const safe = q
        .trim()
        .toLowerCase()
        .replace(/[%_\\]/g, "\\$&");
      const term = `%${safe}%`;
      qb.where(
        "LOWER(market.title) LIKE :term ESCAPE '\\' OR LOWER(market.description) LIKE :term ESCAPE '\\'",
        { term },
      );
    }

    const markets = await qb.getMany();
    // Attach reputation signal to each market's outcomes (fire in parallel)
    await Promise.all(markets.map((m) => this.attachSignal(m)));
    await this.redis.setJsonEx(cacheKey, 30, markets);
    return markets;
  }

  async findOne(id: string): Promise<Market> {
    const cacheKey = `oro:cache:market:${id}`;
    const cached = await this.redis.getJson<Market>(cacheKey);
    if (cached) return cached;
    const market = await this.marketRepo.findOne({
      where: { id },
      relations: ["outcomes"],
    });
    if (!market) throw new NotFoundException("Market not found");
    await this.attachSignal(market);
    await this.redis.setJsonEx(cacheKey, 30, market);
    return market;
  }

  /**
   * Attaches reputationSignal (0–1) to each outcome in-place, and attaches
   * signalMeta (composite confidence dimensions) to the market itself.
   * Signal is null when there are fewer than 3 unique bettors.
   */
  private async attachSignal(market: Market): Promise<void> {
    if (!market.outcomes?.length || Number(market.totalPool) === 0) return;
    const ids = market.outcomes.map((o) => o.id);
    const [signal, signalMeta, weightedShares] = await Promise.all([
      this.reputationService.computeMarketSignal(
        market.id,
        ids,
        market.category,
      ),
      this.reputationService.computeSignalConfidence(
        market.id,
        market.category,
      ),
      this.reputationService.computeReputationWeightedShares(market.id),
    ]);

    // Reputation-weighted LMSR probabilities (Feature 1)
    // Run LMSR on effective shares keyed by outcome order
    const b = Number(market.liquidityParam) || 1000;
    const effectiveAmounts = ids.map((id) => weightedShares[id] ?? 0);
    const hasWeightedData = effectiveAmounts.some((a) => a > 0);
    let repWeightedProbs: number[] = [];
    if (hasWeightedData) {
      const maxA = Math.max(...effectiveAmounts);
      const exps = effectiveAmounts.map((a) => Math.exp((a - maxA) / b));
      const sumExp = exps.reduce((s, e) => s + e, 0);
      repWeightedProbs = exps.map((e) => parseFloat((e / sumExp).toFixed(6)));
    }

    for (let i = 0; i < market.outcomes.length; i++) {
      const outcome = market.outcomes[i];
      (outcome as any).reputationSignal =
        signal[outcome.id] != null ? signal[outcome.id] : null;
      // intelligenceProb: rep-weighted LMSR (null when no data)
      (outcome as any).intelligenceProb = hasWeightedData
        ? repWeightedProbs[i]
        : null;
    }
    (market as any).signalMeta = signalMeta;
  }

  async update(id: string, dto: UpdateMarketDto): Promise<Market> {
    const market = await this.findOne(id);

    if (dto.title) market.title = dto.title;
    if (dto.description) market.description = dto.description;
    if (dto.imageUrl) market.imageUrl = dto.imageUrl;
    if (dto.resolutionCriteria !== undefined)
      market.resolutionCriteria = dto.resolutionCriteria;
    if (dto.opensAt) market.opensAt = new Date(dto.opensAt);
    if (dto.closesAt) market.closesAt = new Date(dto.closesAt);
    if (dto.houseEdgePct !== undefined) market.houseEdgePct = dto.houseEdgePct;
    if (dto.liquidityParam !== undefined)
      market.liquidityParam = dto.liquidityParam;

    const saved = await this.marketRepo.save(market);
    await this.invalidateMarketCache(id);
    return saved;
  }

  async placeBet(userId: string, marketId: string, dto: OpenPositionDto) {
    return this.engine.placePosition(
      userId,
      marketId,
      dto.outcomeId,
      dto.amount,
    );
    // cache invalidation handled inside ParimutuelEngine.placeBet
  }

  async transition(marketId: string, to: MarketStatus) {
    const result = await this.engine.transitionMarket(marketId, to);
    await this.invalidateMarketCache(marketId);
    return result;
  }

  async proposeResolution(marketId: string, proposedOutcomeId: string) {
    const result = await this.engine.proposeResolution(
      marketId,
      proposedOutcomeId,
    );
    await this.invalidateMarketCache(marketId);
    return result;
  }

  async resolve(marketId: string, winningOutcomeId: string) {
    const result = await this.engine.resolveMarket(marketId, winningOutcomeId);
    await this.invalidateMarketCache(marketId);
    // Post resolution to channel (non-blocking)
    const market = await this.findOne(marketId).catch(() => null);
    if (market) {
      const winner = market.outcomes.find((o) => o.id === winningOutcomeId);
      this.telegram
        .postToChannel(
          `Market resolved: <b>${market.title}</b>\nWinner: <b>${winner?.label ?? "Unknown"}</b>`,
        )
        .catch(() => undefined);
    }
    return result;
  }

  async cancel(marketId: string) {
    // Load market + affected positions BEFORE cancelling so we can notify bettors
    const market = await this.marketRepo.findOne({
      where: { id: marketId },
    });

    // Collect all pending positions for this market to know who to notify
    const pendingPositions = market
      ? await this.dataSource
          .getRepository(Position)
          .createQueryBuilder("p")
          .innerJoinAndSelect("p.user", "u")
          .where("p.marketId = :marketId", { marketId })
          .andWhere("p.status = :status", { status: PositionStatus.PENDING })
          .getMany()
      : [];

    const result = await this.engine.cancelMarket(marketId);
    await this.invalidateMarketCache(marketId);

    if (market) {
      // 1. Channel announcement
      this.telegram
        .postToChannel(
          `❌ <b>Market Cancelled: ${market.title}</b>\n\nAll pending bets have been fully refunded.`,
        )
        .catch(() => undefined);

      // 2. Individual DM to every unique bettor whose position was refunded
      const seenUsers = new Set<string>();
      for (const pos of pendingPositions) {
        const user = (pos as any).user as User | undefined;
        if (!user?.telegramId || seenUsers.has(user.id)) continue;
        seenUsers.add(user.id);
        this.telegram
          .sendMessage(
            Number(user.telegramId),
            `❌ <b>Market Cancelled</b>\n\n` +
              `📊 <b>${market.title}</b>\n\n` +
              `Your bet of <b>Nu ${Number(pos.amount).toLocaleString()}</b> has been fully refunded to your balance.`,
          )
          .catch(() => undefined);
      }
    }

    return result;
  }

  // Dispute constants
  private readonly DISPUTE_MIN_PARTICIPANTS = 3;
  private readonly DISPUTE_MIN_BOND = 10;
  private readonly DISPUTE_BOND_PCT = 0.01;

  async submitDispute(
    userId: string,
    marketId: string,
    dto: SubmitDisputeDto,
  ): Promise<Dispute> {
    if (!dto.paymentId && !dto.bondAmount)
      throw new BadRequestException(
        "Either paymentId (DK Bank) or bondAmount (credits) is required",
      );

    // Serialize concurrent financial ops per user so the balance check and
    // the DISPUTE_BOND deduction are atomic with respect to any concurrent
    // bet placement that might also be touching this user's ledger.
    let lockToken: string | null = null;
    try {
      lockToken = await this.redis.acquireLockWithRetry(
        `user:${userId}:wallet`,
        10,
        3,
        150,
      );
    } catch {
      // Redis unavailable — proceed; DB transaction still prevents negative balance
      // as long as no concurrent writes slip through (low probability in practice)
    }

    try {
      return await this._submitDisputeInner(userId, marketId, dto);
    } finally {
      if (lockToken)
        await this.redis.releaseLock(`user:${userId}:wallet`, lockToken);
      await this.redis.del(`oro:cache:balance:${userId}`);
    }
  }

  private async _submitDisputeInner(
    userId: string,
    marketId: string,
    dto: SubmitDisputeDto,
  ): Promise<Dispute> {
    const market = await this.findOne(marketId);
    if (market.status !== MarketStatus.RESOLVING)
      throw new BadRequestException(
        "Disputes can only be submitted during the resolution window",
      );

    if (market.disputeDeadlineAt && new Date() > market.disputeDeadlineAt)
      throw new BadRequestException("Dispute window has closed");

    // Guard 1: market must have at least 3 unique participants
    const { count: participantCount } = await this.dataSource
      .getRepository(Position)
      .createQueryBuilder("p")
      .select("COUNT(DISTINCT p.userId)", "count")
      .where("p.marketId = :marketId", { marketId })
      .getRawOne();
    if (Number(participantCount) < this.DISPUTE_MIN_PARTICIPANTS)
      throw new BadRequestException(
        `Disputes require at least ${this.DISPUTE_MIN_PARTICIPANTS} participants in the market`,
      );

    // Guard 2: disputer must hold an active position in this market
    const hasPosition = await this.dataSource.getRepository(Position).findOne({
      where: {
        userId,
        marketId,
        status: PositionStatus.PENDING,
      },
    });
    if (!hasPosition)
      throw new BadRequestException(
        "You must have an active position in this market to raise a dispute",
      );

    // Guard 3: one dispute per user per market
    const alreadyDisputed = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { userId, marketId } });
    if (alreadyDisputed)
      throw new BadRequestException(
        "You have already submitted a dispute for this market",
      );

    // Guard 4: minimum bond = max(MIN_BOND, pool × BOND_PCT)
    const pool = Number(market.totalPool);
    const minBond = Math.max(
      this.DISPUTE_MIN_BOND,
      Math.ceil(pool * this.DISPUTE_BOND_PCT),
    );
    const submittedBond = dto.bondAmount ?? 0;
    // For DK Bank path we validate after reading payment amount below,
    // so only check here for the credits path
    if (!dto.paymentId && submittedBond < minBond)
      throw new BadRequestException(
        `Dispute bond must be at least Nu ${minBond} (1% of pool, min Nu ${this.DISPUTE_MIN_BOND})`,
      );

    return await this.dataSource.transaction(async (em) => {
      let bondAmount: number;

      if (dto.paymentId) {
        //  DK Bank path: verify a completed payment
        const payment = await em.getRepository(Payment).findOne({
          where: {
            id: dto.paymentId,
            userId,
            status: PaymentStatus.SUCCESS,
            method: PaymentMethod.DK_BANK,
          },
        });
        if (!payment)
          throw new BadRequestException(
            "DK Bank payment not found, not completed, or does not belong to you",
          );

        // Ensure this payment hasn't already been used for a dispute
        const existing = await em
          .getRepository(Dispute)
          .findOne({ where: { bondPaymentId: dto.paymentId } });
        if (existing)
          throw new BadRequestException(
            "This payment has already been used for a dispute",
          );

        bondAmount = Number(payment.amount);

        if (bondAmount < minBond)
          throw new BadRequestException(
            `Dispute bond must be at least Nu ${minBond} (1% of pool, min Nu ${this.DISPUTE_MIN_BOND})`,
          );

        return em.save(
          Dispute,
          em.create(Dispute, {
            userId,
            marketId,
            bondAmount,
            bondPaymentId: dto.paymentId,
            reason: dto.reason ?? null,
            bondRefunded: false,
          }),
        );
      } else {
        // Credits path: deduct from balance
        bondAmount = dto.bondAmount!;
        const { balance } = await em
          .getRepository(Transaction)
          .createQueryBuilder("t")
          .select("COALESCE(SUM(t.amount), 0)", "balance")
          .where("t.userId = :userId", { userId })
          .getRawOne();
        const balanceBefore = Number(balance);
        if (balanceBefore < bondAmount)
          throw new BadRequestException(
            "Insufficient balance for dispute bond",
          );

        await em.save(
          Transaction,
          em.create(Transaction, {
            type: TransactionType.DISPUTE_BOND,
            amount: -bondAmount,
            balanceBefore,
            balanceAfter: balanceBefore - bondAmount,
            userId,
            note: `Dispute bond for market resolution`,
          }),
        );

        return em.save(
          Dispute,
          em.create(Dispute, {
            userId,
            marketId,
            bondAmount,
            reason: dto.reason ?? null,
            bondRefunded: false,
          }),
        );
      }
    });
  }

  async getResolvedMarkets(): Promise<object[]> {
    const markets = await this.marketRepo
      .createQueryBuilder("market")
      .leftJoinAndSelect("market.outcomes", "outcome")
      .where("market.status IN (:...statuses)", {
        statuses: [MarketStatus.RESOLVED, MarketStatus.SETTLED],
      })
      .orderBy("market.resolvedAt", "DESC")
      .getMany();

    if (!markets.length) return [];

    // Single query to get participant counts for all markets at once (avoids N+1)
    const marketIds = markets.map((m) => m.id);
    const participantRows: { marketId: string; count: string }[] =
      await this.dataSource
        .getRepository(Position)
        .createQueryBuilder("p")
        .select("p.marketId", "marketId")
        .addSelect("COUNT(DISTINCT p.userId)", "count")
        .where("p.marketId IN (:...marketIds)", { marketIds })
        .groupBy("p.marketId")
        .getRawMany();

    const participantMap = new Map(
      participantRows.map((r) => [r.marketId, Number(r.count)]),
    );

    return markets.map((m) => {
      const winner =
        m.outcomes.find((o) => o.id === m.resolvedOutcomeId) ?? null;
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        imageUrl: m.imageUrl,
        category: m.category,
        status: m.status,
        totalPool: m.totalPool,
        resolutionCriteria: m.resolutionCriteria ?? null,
        createdAt: m.createdAt,
        opensAt: m.opensAt,
        closesAt: m.closesAt,
        resolvedAt: m.resolvedAt,
        participantCount: participantMap.get(m.id) ?? 0,
        winner: winner ? { id: winner.id, label: winner.label } : null,
      };
    });
  }

  getDisputesByMarket(marketId: string): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: { marketId },
      order: { createdAt: "DESC" },
    });
  }

  /** Returns the minimum bond required to raise a dispute on this market. */
  async getDisputeRequirements(marketId: string): Promise<{
    minBond: number;
    minParticipants: number;
    eligible: boolean;
    reason: string | null;
  }> {
    const market = await this.findOne(marketId);
    const pool = Number(market.totalPool);
    const minBond = Math.max(
      this.DISPUTE_MIN_BOND,
      Math.ceil(pool * this.DISPUTE_BOND_PCT),
    );

    const { count } = await this.dataSource
      .getRepository(Position)
      .createQueryBuilder("p")
      .select("COUNT(DISTINCT p.userId)", "count")
      .where("p.marketId = :marketId", { marketId })
      .getRawOne();

    const participantCount = Number(count);
    const eligible = participantCount >= this.DISPUTE_MIN_PARTICIPANTS;

    return {
      minBond,
      minParticipants: this.DISPUTE_MIN_PARTICIPANTS,
      eligible,
      reason: eligible
        ? null
        : `Market needs at least ${this.DISPUTE_MIN_PARTICIPANTS} participants (currently ${participantCount})`,
    };
  }

  async delete(id: string): Promise<void> {
    const market = await this.findOne(id);
    await this.marketRepo.remove(market);
    await this.invalidateMarketCache(id);
  }
}
