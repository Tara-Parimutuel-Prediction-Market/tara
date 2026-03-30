import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  Min,
  Max,
  IsArray,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Market, MarketStatus, MarketMechanism } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Dispute } from "../entities/dispute.entity";
import { Payment, PaymentMethod, PaymentStatus } from "../entities/payment.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { User } from "../entities/user.entity";
import { ParimutuelEngine } from "./parimutuel.engine";
import { LMSRService } from "./lmsr.service";
export class CreateMarketDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() opensAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() closesAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  houseEdgePct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  liquidityParam?: number;

  @ApiProperty({
    type: [String],
    description: 'Outcome labels e.g. ["Team A wins","Draw","Team B wins"]',
  })
  @IsArray()
  @IsString({ each: true })
  outcomes: string[];
}

export class UpdateMarketDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() opensAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() closesAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(50) houseEdgePct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() liquidityParam?: number;
}

export class PlaceBetDto {
  @ApiProperty() @IsUUID() outcomeId: string;
  @ApiProperty() @IsNumber() @Min(1) amount: number;
}

export class SubmitDisputeDto {
  @ApiPropertyOptional({ description: "Bond amount in credits (used when paying from credit balance)" })
  @IsOptional()
  bondAmount?: number;

  @ApiPropertyOptional({ description: "Completed DK Bank payment ID to use as bond" })
  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @ApiPropertyOptional({ description: "Reason for disputing the proposed outcome" })
  @IsOptional()
  @IsString()
  reason?: string;
}

@Injectable()
export class MarketsService {
  constructor(
    @InjectRepository(Market) private marketRepo: Repository<Market>,
    @InjectRepository(Outcome) private outcomeRepo: Repository<Outcome>,
    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private engine: ParimutuelEngine,
    private lmsrService: LMSRService,
    private dataSource: DataSource,
  ) {}

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
        opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
        houseEdgePct: dto.houseEdgePct ?? 5,
        mechanism: MarketMechanism.PARIMUTUEL,
        liquidityParam: liquidityParam,
        outcomes: outcomes,
        totalPool: 0,
        status: MarketStatus.UPCOMING,
      });

      const saved = await this.marketRepo.save(market);
      console.log(`✅ Market created successfully: ${saved.id}`);
      return this.findOne(saved.id);
    } catch (err) {
      console.error("❌ Error in MarketsService.create:", err);
      throw err;
    }
  }

  findAll(): Promise<Market[]> {
    return this.marketRepo.find({ order: { createdAt: "DESC" } });
  }

  async findOne(id: string): Promise<Market> {
    const market = await this.marketRepo.findOne({
      where: { id },
      relations: ["outcomes"],
    });
    if (!market) throw new NotFoundException("Market not found");
    return market;
  }

  async update(id: string, dto: UpdateMarketDto): Promise<Market> {
    const market = await this.findOne(id);
    
    if (dto.title) market.title = dto.title;
    if (dto.description) market.description = dto.description;
    if (dto.imageUrl) market.imageUrl = dto.imageUrl;
    if (dto.opensAt) market.opensAt = new Date(dto.opensAt);
    if (dto.closesAt) market.closesAt = new Date(dto.closesAt);
    if (dto.houseEdgePct !== undefined) market.houseEdgePct = dto.houseEdgePct;
    if (dto.liquidityParam !== undefined) market.liquidityParam = dto.liquidityParam;

    return this.marketRepo.save(market);
  }

  async placeBet(userId: string, marketId: string, dto: PlaceBetDto) {
    return this.engine.placeBet(userId, marketId, dto.outcomeId, dto.amount);
  }

  transition(marketId: string, to: MarketStatus) {
    return this.engine.transitionMarket(marketId, to);
  }

  proposeResolution(marketId: string, proposedOutcomeId: string) {
    return this.engine.proposeResolution(marketId, proposedOutcomeId);
  }

  resolve(marketId: string, winningOutcomeId: string) {
    return this.engine.resolveMarket(marketId, winningOutcomeId);
  }

  cancel(marketId: string) {
    return this.engine.cancelMarket(marketId);
  }

  async submitDispute(userId: string, marketId: string, dto: SubmitDisputeDto): Promise<Dispute> {
    if (!dto.paymentId && !dto.bondAmount)
      throw new BadRequestException("Either paymentId (DK Bank) or bondAmount (credits) is required");

    const market = await this.findOne(marketId);
    if (market.status !== MarketStatus.RESOLVING)
      throw new BadRequestException("Disputes can only be submitted during the resolution window");

    if (market.disputeDeadlineAt && new Date() > market.disputeDeadlineAt)
      throw new BadRequestException("Dispute window has closed");

    return await this.dataSource.transaction(async (em) => {
      let bondAmount: number;

      if (dto.paymentId) {
        // ── DK Bank path: verify a completed payment ──────────────────────────
        const payment = await em.getRepository(Payment).findOne({
          where: { id: dto.paymentId, userId, status: PaymentStatus.SUCCESS, method: PaymentMethod.DK_BANK },
        });
        if (!payment)
          throw new BadRequestException("DK Bank payment not found, not completed, or does not belong to you");

        // Ensure this payment hasn't already been used for a dispute
        const existing = await em.getRepository(Dispute).findOne({ where: { bondPaymentId: dto.paymentId } });
        if (existing)
          throw new BadRequestException("This payment has already been used for a dispute");

        bondAmount = Number(payment.amount);

        return em.save(Dispute, em.create(Dispute, {
          userId,
          marketId,
          bondAmount,
          bondPaymentId: dto.paymentId,
          reason: dto.reason ?? null,
          bondRefunded: false,
        }));
      } else {
        // ── Credits path: deduct from balance ─────────────────────────────────
        bondAmount = dto.bondAmount!;
        const { balance } = await em.getRepository(Transaction)
          .createQueryBuilder("t")
          .select("COALESCE(SUM(t.amount), 0)", "balance")
          .where("t.userId = :userId", { userId })
          .getRawOne();
        const balanceBefore = Number(balance);
        if (balanceBefore < bondAmount)
          throw new BadRequestException("Insufficient balance for dispute bond");

        await em.save(Transaction, em.create(Transaction, {
          type: TransactionType.DISPUTE_BOND,
          amount: -bondAmount,
          balanceBefore,
          balanceAfter: balanceBefore - bondAmount,
          userId,
          note: `Dispute bond for market resolution`,
        }));

        return em.save(Dispute, em.create(Dispute, {
          userId,
          marketId,
          bondAmount,
          reason: dto.reason ?? null,
          bondRefunded: false,
        }));
      }
    });
  }

  getDisputesByMarket(marketId: string): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: { marketId },
      order: { createdAt: "DESC" },
    });
  }

  async delete(id: string): Promise<void> {
    const market = await this.findOne(id);
    await this.marketRepo.remove(market);
  }
}
