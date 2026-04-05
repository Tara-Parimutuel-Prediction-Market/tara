import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Patch,
  HttpCode,
  Delete,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { JwtAuthGuard, AdminGuard } from "../auth/guards";
import { MarketsService, CreateMarketDto } from "../markets/markets.service";
import { FixturesService } from "./fixtures.service";
import { AuditService } from "./audit.service";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { AuditAction } from "../entities/audit-log.entity";
import { Market, MarketStatus } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Settlement } from "../entities/settlement.entity";
import { Dispute } from "../entities/dispute.entity";
import { Bet } from "../entities/bet.entity";
import { User } from "../entities/user.entity";
import { Payment } from "../entities/payment.entity";

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

class ProposeResolutionDto {
  @ApiProperty({ description: "UUID of the proposed winning outcome" })
  @IsUUID()
  proposedOutcomeId: string;
}

class GetUsersQueryDto {
  /** Full-text search across name, username, telegramId, dkCid, dkAccountName */
  @ApiPropertyOptional({ description: "Search query (max 200 chars)" })
  @IsOptional()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ["all", "admin", "user"], default: "all" })
  @IsOptional()
  @IsIn(["all", "admin", "user"])
  role?: "all" | "admin" | "user";

  @ApiPropertyOptional({ enum: ["all", "linked", "unlinked"], default: "all" })
  @IsOptional()
  @IsIn(["all", "linked", "unlinked"])
  dkStatus?: "all" | "linked" | "unlinked";

  @ApiPropertyOptional({
    enum: ["name", "balance", "streak", "joined"],
    default: "joined",
  })
  @IsOptional()
  @IsIn(["name", "balance", "streak", "joined"])
  sortField?: "name" | "balance" | "streak" | "joined";

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";

  @ApiPropertyOptional({ default: 1, description: "Page number (1-based)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: 20,
    description: "Results per page (max 100)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private marketsService: MarketsService,
    private fixturesService: FixturesService,
    private auditService: AuditService,
    private telegramSimple: TelegramSimpleService,
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    @InjectRepository(Dispute) private disputeRepo: Repository<Dispute>,
    @InjectRepository(Bet) private betRepo: Repository<Bet>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
  ) {}

  // ── Markets ────────────────────────────────────────────────────────────────
  @Post("markets")
  @ApiOperation({ summary: "Create a new market with outcomes" })
  async createMarket(@Body() dto: CreateMarketDto, @Request() req) {
    const market = await this.marketsService.create(dto);
    await this.auditService.log({
      adminId: req.user.userId,
      action: AuditAction.MARKET_CREATE,
      entityType: "market",
      entityId: market.id,
      after: {
        title: market.title,
        outcomes: dto.outcomes,
        closesAt: dto.closesAt,
      },
      ipAddress: req.ip,
    });
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || "";
    const outcomes = (market.outcomes ?? [])
      .map((o) => `• ${o.label}`)
      .join("\n");
    const closesAt = market.closesAt
      ? new Date(market.closesAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "TBD";
    await this.telegramSimple.postToChannel(
      `🚀 <b>NEW MARKET</b>\n\n📊 <b>${market.title}</b>\n\n🎲 <b>Outcomes:</b>\n${outcomes}\n\n⏰ Closes: ${closesAt}\n\n👉 <a href="${miniAppUrl}">Predict Now</a>`,
    );
    return market;
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
  async transitionMarket(
    @Param("id") id: string,
    @Body() dto: TransitionDto,
    @Request() req,
  ) {
    const before = await this.marketsService.findOne(id);
    const result = await this.marketsService.transition(id, dto.status);
    await this.auditService.log({
      adminId: req.user.userId,
      action: AuditAction.MARKET_TRANSITION,
      entityType: "market",
      entityId: id,
      before: { status: before.status },
      after: { status: dto.status },
      meta: { title: before.title },
      ipAddress: req.ip,
    });
    return result;
  }

  @Post("markets/:id/propose")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Propose winning outcome — opens 24h dispute window (Closed → Resolving)",
  })
  @ApiResponse({ status: 200, type: Market })
  async proposeResolution(
    @Param("id") id: string,
    @Body() dto: ProposeResolutionDto,
    @Request() req,
  ) {
    const before = await this.marketsService.findOne(id);
    const result = await this.marketsService.proposeResolution(
      id,
      dto.proposedOutcomeId,
    );
    const proposedOutcome = before.outcomes?.find(
      (o) => o.id === dto.proposedOutcomeId,
    );
    await this.auditService.log({
      adminId: req.user.userId,
      action: AuditAction.MARKET_PROPOSE,
      entityType: "market",
      entityId: id,
      before: { status: before.status, proposedOutcomeId: null },
      after: { status: "resolving", proposedOutcomeId: dto.proposedOutcomeId },
      meta: {
        title: before.title,
        proposedOutcomeLabel: proposedOutcome?.label,
      },
      ipAddress: req.ip,
    });
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || "";
    await this.telegramSimple.postToChannel(
      `⚖️ <b>DISPUTE WINDOW OPEN</b>\n\n📊 <b>${before.title}</b>\n\n🔖 <b>Proposed Winner:</b> ${proposedOutcome?.label ?? "N/A"}\n⏳ Dispute window: 24 hours\n\n👉 <a href="${miniAppUrl}">Submit Dispute</a>`,
    );
    return result;
  }

  @Post("markets/:id/resolve")
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Final resolution after dispute window — set winner & auto-settle (Resolving → Settled)",
  })
  async resolveMarket(
    @Param("id") id: string,
    @Body() dto: ResolveDto,
    @Request() req,
  ) {
    const before = await this.marketsService.findOne(id);
    const result = await this.marketsService.resolve(id, dto.winningOutcomeId);
    const winningOutcome = before.outcomes?.find(
      (o) => o.id === dto.winningOutcomeId,
    );
    const totalBets =
      before.outcomes?.reduce((s, o) => s + Number(o.totalBetAmount), 0) ?? 0;
    await this.auditService.log({
      adminId: req.user.userId,
      action: AuditAction.MARKET_RESOLVE,
      entityType: "market",
      entityId: id,
      before: { status: before.status },
      after: { status: "settled", winningOutcomeId: dto.winningOutcomeId },
      meta: {
        title: before.title,
        winningOutcomeLabel: winningOutcome?.label,
        totalPool: before.totalPool,
        totalBets,
      },
      ipAddress: req.ip,
    });
    const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || "";
    await this.telegramSimple.postToChannel(
      `✅ <b>MARKET RESOLVED</b>\n\n📊 <b>${before.title}</b>\n\n🏆 <b>Winner:</b> ${winningOutcome?.label ?? "N/A"}\n💰 <b>Pool:</b> Nu ${Number(before.totalPool).toLocaleString()}\n\n👉 <a href="${miniAppUrl}">View Results</a>`,
    );
    return result;
  }

  @Get("markets/:id/disputes")
  @ApiOperation({ summary: "List disputes for a specific market" })
  @ApiResponse({ status: 200, type: [Dispute] })
  getMarketDisputes(@Param("id") id: string) {
    return this.marketsService.getDisputesByMarket(id);
  }

  @Get("disputes")
  @ApiOperation({ summary: "List all disputes across all markets" })
  @ApiResponse({ status: 200, type: [Dispute] })
  getAllDisputes() {
    return this.disputeRepo.find({ order: { createdAt: "DESC" }, take: 500 });
  }

  @Post("markets/:id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel market & refund all bets" })
  async cancelMarket(@Param("id") id: string, @Request() req) {
    const before = await this.marketsService.findOne(id);
    const result = await this.marketsService.cancel(id);
    await this.auditService.log({
      adminId: req.user.userId,
      action: AuditAction.MARKET_CANCEL,
      entityType: "market",
      entityId: id,
      before: { status: before.status, totalPool: before.totalPool },
      after: { status: "cancelled" },
      meta: { title: before.title },
      ipAddress: req.ip,
    });
    return result;
  }

  @HttpCode(204)
  @Delete("markets/:id")
  @ApiOperation({ summary: "Delete a market" })
  async deleteMarket(@Param("id") id: string, @Request() req) {
    const before = await this.marketsService.findOne(id);
    await this.auditService.log({
      adminId: req.user.userId,
      action: AuditAction.MARKET_DELETE,
      entityType: "market",
      entityId: id,
      before: { title: before.title, status: before.status },
      ipAddress: req.ip,
    });
    return this.marketsService.delete(id);
  }

  // ── Fixtures ──────────────────────────────────────────────────────────────
  @Get("fixtures")
  @ApiOperation({
    summary: "Fetch upcoming football fixtures from football-data.org",
  })
  getFixtures(@Query("q") q?: string) {
    return this.fixturesService.getFixtures(q);
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
      .leftJoinAndMapOne(
        "settlement.market",
        Market,
        "market",
        "market.id = settlement.marketId",
      )
      .leftJoinAndMapOne(
        "settlement.outcome",
        Outcome,
        "outcome",
        "outcome.id = settlement.winningOutcomeId",
      )
      .orderBy("settlement.settledAt", "DESC")
      .getMany();
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  @Get("users")
  @ApiOperation({
    summary: "List users with search, filters, sort and pagination",
  })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "role", required: false, enum: ["all", "admin", "user"] })
  @ApiQuery({
    name: "dkStatus",
    required: false,
    enum: ["all", "linked", "unlinked"],
  })
  @ApiQuery({
    name: "sortField",
    required: false,
    enum: ["name", "balance", "streak", "joined"],
  })
  @ApiQuery({ name: "sortDir", required: false, enum: ["asc", "desc"] })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listUsers(@Query() query: GetUsersQueryDto) {
    const {
      search,
      role = "all",
      dkStatus = "all",
      sortField = "joined",
      sortDir = "desc",
      page = 1,
      limit = 20,
    } = query;

    const qb = this.userRepo
      .createQueryBuilder("u")
      .select([
        "u.id",
        "u.firstName",
        "u.lastName",
        "u.username",
        "u.photoUrl",
        "u.isAdmin",
        "u.telegramId",
        "u.telegramChatId",
        "u.telegramStreak",
        "u.telegramLinkedAt",
        "u.dkCid",
        "u.dkAccountNumber",
        "u.dkAccountName",
        "u.createdAt",
        "u.updatedAt",
      ]);

    // ── Full-text search ────────────────────────────────────────────────────
    if (search && search.trim()) {
      // Escape LIKE special chars so user input cannot wildcard-scan arbitrary data
      const safe = search.trim().toLowerCase().replace(/[%_\\]/g, "\\$&");
      const term = `%${safe}%`;
      qb.andWhere(
        `(
          LOWER(COALESCE(u.firstName,'')  || ' ' || COALESCE(u.lastName,'')) LIKE :term ESCAPE '\\'
          OR LOWER(COALESCE(u.username,''))      LIKE :term ESCAPE '\\'
          OR LOWER(COALESCE(u.telegramId,''))    LIKE :term ESCAPE '\\'
          OR LOWER(COALESCE(u.dkCid,''))         LIKE :term ESCAPE '\\'
          OR LOWER(COALESCE(u.dkAccountName,'')) LIKE :term ESCAPE '\\'
          OR LOWER(u.id::text)                   LIKE :term ESCAPE '\\'
        )`,
        { term },
      );
    }

    // ── Role filter ─────────────────────────────────────────────────────────
    if (role === "admin")
      qb.andWhere("u.isAdmin = :isAdmin", { isAdmin: true });
    if (role === "user")
      qb.andWhere("u.isAdmin = :isAdmin", { isAdmin: false });

    // ── DK-link filter ──────────────────────────────────────────────────────
    if (dkStatus === "linked") qb.andWhere("u.dkCid IS NOT NULL");
    if (dkStatus === "unlinked") qb.andWhere("u.dkCid IS NULL");

    // ── Sort ────────────────────────────────────────────────────────────────
    const dir = sortDir.toUpperCase() as "ASC" | "DESC";
    if (sortField === "name") {
      qb.orderBy(
        "LOWER(COALESCE(u.firstName,'') || ' ' || COALESCE(u.lastName,''))",
        dir,
      );
    } else if (sortField === "streak") {
      qb.orderBy("COALESCE(u.telegramStreak, 0)", dir);
    } else {
      // joined (default)
      qb.orderBy("u.createdAt", dir);
    }

    // ── Pagination ──────────────────────────────────────────────────────────
    const take = Math.min(Number(limit), 100);
    const skip = (Math.max(Number(page), 1) - 1) * take;

    qb.skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: Math.max(Number(page), 1),
      limit: take,
      pages: Math.ceil(total / take),
    };
  }

  // ── Payments ───────────────────────────────────────────────────────────────
  @Get("payments")
  @ApiOperation({ summary: "List all payments (admin view)" })
  listPayments() {
    return this.paymentRepo.find({
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: 500,
    });
  }

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  @Get("audit-logs")
  @ApiOperation({ summary: "Paginated, server-side filterable audit trail" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "adminId", required: false })
  @ApiQuery({ name: "entityType", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "from", required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: false, description: "YYYY-MM-DD inclusive" })
  getAuditLogs(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("adminId") adminId?: string,
    @Query("entityType") entityType?: string,
    @Query("search") search?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.auditService.findPaginated({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      action,
      adminId: adminId || undefined,
      entityType,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }

  /** Must come BEFORE /audit-logs/admin/:adminId to avoid route shadowing */
  @Get("audit-logs/admins")
  @ApiOperation({ summary: "Distinct admins for filter dropdowns" })
  getAuditAdmins() {
    return this.auditService.findDistinctAdmins();
  }

  @Get("audit-logs/admin/:adminId")
  @ApiOperation({ summary: "Audit trail for a specific admin account" })
  getAuditLogsByAdmin(@Param("adminId") adminId: string) {
    return this.auditService.findByAdmin(adminId);
  }

  @Get("audit-logs/entity/:entityId")
  @ApiOperation({
    summary: "Audit trail for a specific entity (market, user, etc.)",
  })
  getAuditLogsByEntity(@Param("entityId") entityId: string) {
    return this.auditService.findByEntity(entityId);
  }
}
