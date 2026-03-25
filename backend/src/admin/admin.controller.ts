import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Patch,
  HttpCode,
  Delete,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiProperty,
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IsUUID, IsEnum } from "class-validator";
import { JwtAuthGuard, AdminGuard } from "../auth/guards";
import { MarketsService, CreateMarketDto } from "../markets/markets.service";
import { Market, MarketStatus } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Settlement } from "../entities/settlement.entity";
import { Bet } from "../entities/bet.entity";
import { User } from "../entities/user.entity";

class TransitionDto {
  @ApiProperty({ enum: MarketStatus })
  @IsEnum(MarketStatus)
  status: MarketStatus;
}

class ResolveDto {
  @ApiProperty({ description: "UUID of the winning outcome" })
  @IsUUID()
  winningOutcomeId: string;
}

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private marketsService: MarketsService,
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    @InjectRepository(Bet) private betRepo: Repository<Bet>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  // ── Markets ────────────────────────────────────────────────────────────────
  @Post("markets")
  @ApiOperation({ summary: "Create a new market with outcomes" })
  createMarket(@Body() dto: CreateMarketDto) {
    return this.marketsService.create(dto);
  }

  @Get("markets")
  @ApiOperation({ summary: "List all markets (admin view)" })
  listMarkets() {
    return this.marketsService.findAll();
  }

  @Get("markets/:id")
  @ApiOperation({ summary: "Get market details" })
  getMarket(@Param("id") id: string) {
    return this.marketsService.findOne(id);
  }

  @Patch("markets/:id/status")
  @ApiOperation({
    summary: "Transition market state (Upcoming→Open→Closed→Cancelled)",
  })
  transitionMarket(@Param("id") id: string, @Body() dto: TransitionDto) {
    return this.marketsService.transition(id, dto.status);
  }

  @Post("markets/:id/resolve")
  @HttpCode(200)
  @ApiOperation({ summary: "Resolve market: set winner & auto-settle payouts" })
  resolveMarket(@Param("id") id: string, @Body() dto: ResolveDto) {
    return this.marketsService.resolve(id, dto.winningOutcomeId);
  }

  @Post("markets/:id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel market & refund all bets" })
  cancelMarket(@Param("id") id: string) {
    return this.marketsService.cancel(id);
  }

  @HttpCode(204)
  @Delete("markets/:id")
  @ApiOperation({ summary: "Delete a market" })
  deleteMarket(@Param("id") id: string) {
    return this.marketsService.delete(id);
  }

  // ── Pool view ─────────────────────────────────────────────────────────────
  @Get("markets/:id/pool")
  @ApiOperation({ summary: "View pool breakdown per outcome" })
  async viewPool(@Param("id") id: string) {
    const market = await this.marketsService.findOne(id);
    const totalPool = Number(market.totalPool);
    const houseEdge = Number(market.houseEdgePct);
    return {
      marketId: id,
      title: market.title,
      status: market.status,
      totalPool,
      houseEdgePct: houseEdge,
      houseAmount: totalPool * (houseEdge / 100),
      payoutPool: totalPool * (1 - houseEdge / 100),
      outcomes: market.outcomes.map((o) => ({
        id: o.id,
        label: o.label,
        totalBetAmount: Number(o.totalBetAmount),
        currentOdds: Number(o.currentOdds),
        impliedProbability:
          totalPool > 0
            ? ((Number(o.totalBetAmount) / totalPool) * 100).toFixed(2) + "%"
            : "0%",
        isWinner: o.isWinner,
      })),
    };
  }

  // ── Settlements ───────────────────────────────────────────────────────────
  @Get("settlements")
  @ApiOperation({ summary: "List all settlements" })
  listSettlements() {
    return this.settlementRepo
      .createQueryBuilder("settlement")
      .leftJoinAndMapOne("settlement.market", Market, "market", "market.id = settlement.marketId")
      .leftJoinAndMapOne("settlement.outcome", Outcome, "outcome", "outcome.id = settlement.winningOutcomeId")
      .orderBy("settlement.settledAt", "DESC")
      .getMany();
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  @Get("users")
  @ApiOperation({ summary: "List all users" })
  listUsers() {
    return this.userRepo.find({ order: { createdAt: "DESC" } });
  }
}
