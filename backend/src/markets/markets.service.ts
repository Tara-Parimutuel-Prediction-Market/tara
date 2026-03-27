import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  Min,
  Max,
  IsArray,
  IsEnum,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Market, MarketStatus, MarketMechanism } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { ParimutuelEngine } from "./parimutuel.engine";
import { LMSRService } from "./lmsr.service";
import { SCPMService } from "./scpm.service";

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

  @ApiPropertyOptional({ enum: MarketMechanism })
  @IsOptional()
  @IsEnum(MarketMechanism)
  mechanism?: MarketMechanism;

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
  @ApiPropertyOptional({ enum: MarketMechanism }) @IsOptional() @IsEnum(MarketMechanism) mechanism?: MarketMechanism;
  @ApiPropertyOptional() @IsOptional() @IsNumber() liquidityParam?: number;
}

export class PlaceBetDto {
  @ApiProperty() @IsUUID() outcomeId: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) amount?: number;

  // SCPM fields
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxShares?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) limitPrice?: number;
}

@Injectable()
export class MarketsService {
  constructor(
    @InjectRepository(Market) private marketRepo: Repository<Market>,
    @InjectRepository(Outcome) private outcomeRepo: Repository<Outcome>,
    private engine: ParimutuelEngine,
    private lmsrService: LMSRService,
    private scpmService: SCPMService,
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
        mechanism: dto.mechanism ?? MarketMechanism.PARIMUTUEL,
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
    if (dto.mechanism) market.mechanism = dto.mechanism;
    if (dto.liquidityParam !== undefined) market.liquidityParam = dto.liquidityParam;

    return this.marketRepo.save(market);
  }

  async placeBet(userId: string, marketId: string, dto: PlaceBetDto) {
    const market = await this.findOne(marketId);
    if (market.mechanism === MarketMechanism.SCPM) {
      return this.engine.placeBetSCPM(userId, market, dto);
    }
    return this.engine.placeBet(userId, marketId, dto.outcomeId, dto.amount!);
  }

  transition(marketId: string, to: MarketStatus) {
    return this.engine.transitionMarket(marketId, to);
  }

  resolve(marketId: string, winningOutcomeId: string) {
    return this.engine.resolveMarket(marketId, winningOutcomeId);
  }

  cancel(marketId: string) {
    return this.engine.cancelMarket(marketId);
  }

  async delete(id: string): Promise<void> {
    const market = await this.findOne(id);
    await this.marketRepo.remove(market);
  }
}
