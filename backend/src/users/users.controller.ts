import { Controller, Get, UseGuards, Request, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
} from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards";
import { User } from "../entities/user.entity";
import { Payment } from "../entities/payment.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { Position, PositionStatus } from "../entities/position.entity";
import { RedisService } from "../redis/redis.service";

// ─── Response schemas for Swagger ────────────────────────────────────────────

class ProfileResponse {
  @ApiProperty({ example: "uuid-1234" }) id: string;
  @ApiProperty({ example: "Sonam" }) firstName: string;
  @ApiPropertyOptional({ example: "Tenzin" }) lastName: string;
  @ApiPropertyOptional({ example: "sonam_t" }) username: string;
  @ApiPropertyOptional({ example: "https://cdn.example.com/photo.jpg" })
  photoUrl: string;
  @ApiProperty({ example: false }) isAdmin: boolean;
  @ApiProperty({
    example: 1500.5,
    description: "Credits balance computed from transaction ledger",
  })
  creditsBalance: number;
  @ApiProperty() createdAt: Date;
}

class TransactionResponse {
  @ApiProperty({ example: "uuid-5678" }) id: string;
  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.POSITION_OPENED,
  })
  type: TransactionType;
  @ApiProperty({
    example: -100.0,
    description: "Negative = debit, positive = credit",
  })
  amount: number;
  @ApiProperty({ example: 1600.0 }) balanceBefore: number;
  @ApiProperty({ example: 1500.0 }) balanceAfter: number;
  @ApiPropertyOptional({ example: "Position on outcome: Team A" }) note: string;
  @ApiPropertyOptional({ example: "uuid-position" }) positionId: string;
  @ApiPropertyOptional({ example: "uuid-payment" }) paymentId: string;
  @ApiProperty() createdAt: Date;
}

class PositionResponse {
  @ApiProperty({ example: "uuid-bet" }) id: string;
  @ApiProperty({ example: 100.0 }) amount: number;
  @ApiProperty({ enum: PositionStatus, example: PositionStatus.PENDING })
  status: PositionStatus;
  @ApiPropertyOptional({
    example: 1.8,
    description: "Parimutuel odds at time of placement",
  })
  oddsAtPlacement: number;
  @ApiPropertyOptional({
    example: 180.0,
    description: "Payout amount (only set after settlement)",
  })
  payout: number;
  @ApiProperty() placedAt: Date;
  @ApiProperty({ example: "uuid-market" }) marketId: string;
  @ApiProperty({ example: "uuid-outcome" }) outcomeId: string;
  @ApiPropertyOptional({ description: "Market details (eager loaded)" })
  market: any;
  @ApiPropertyOptional({ description: "Outcome details (eager loaded)" })
  outcome: any;
}

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(Position) private betRepo: Repository<Position>,
    private readonly redis: RedisService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get my profile & balance" })
  @ApiResponse({ status: 200, type: ProfileResponse })
  async getMe(@Request() req: any) {
    const userId: string = req.user.userId;

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        "id",
        "firstName",
        "lastName",
        "username",
        "photoUrl",
        "isAdmin",
        "createdAt",
        "telegramId",
        "dkCid",
        "dkAccountName",
        "telegramLinkedAt",
        // reputation fields
        "reputationScore",
        "reputationTier",
        "totalPredictions",
        "correctPredictions",
        "categoryScores",
        // contrarian badge
        "contrarianBadge",
        "contrarianWins",
        "contrarianAttempts",
        // streak
        "telegramStreak",
        // hashes loaded only for boolean derivation — never forwarded to client
        "dkPhoneHash",
        "telegramPhoneHash",
      ],
    });

    const balanceCacheKey = `oro:cache:balance:${userId}`;
    let creditsBalance: number | null =
      await this.redis.getJson<number>(balanceCacheKey);

    if (creditsBalance === null) {
      const { creditsBalance: raw } = await this.transactionRepo
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.amount), 0)", "creditsBalance")
        .where("t.userId = :userId", { userId })
        .getRawOne();
      creditsBalance = Number(raw);
      await this.redis.setJsonEx(balanceCacheKey, 15, creditsBalance);
    }

    // Derive boolean flags — never send raw hashes to the client
    const { dkPhoneHash, telegramPhoneHash, ...safeUser } = user as any;
    return {
      ...safeUser,
      creditsBalance,
      isDkPhoneLinked: !!dkPhoneHash,
      isPhoneVerified: !!(
        telegramPhoneHash &&
        dkPhoneHash &&
        telegramPhoneHash === dkPhoneHash
      ),
    };
  }

  @Get("me/payments")
  @ApiOperation({ summary: "Get my payment history" })
  getPayments(@Request() req: any) {
    return this.paymentRepo.find({
      where: { userId: req.user.userId },
      order: { createdAt: "DESC" },
      take: 50,
    });
  }

  // ── Wallet: transaction ledger ────────────────────────────────────────────

  @Get("me/transactions")
  @ApiOperation({ summary: "Get my transaction ledger (wallet history)" })
  @ApiQuery({
    name: "limit",
    required: false,
    example: 50,
    description: "Max rows to return (default 50)",
  })
  @ApiQuery({
    name: "type",
    required: false,
    enum: TransactionType,
    description: "Filter by transaction type",
  })
  @ApiResponse({ status: 200, type: [TransactionResponse] })
  getTransactions(
    @Request() req: any,
    @Query("limit") limit?: string,
    @Query("type") type?: TransactionType,
  ) {
    const take = Math.min(Number(limit) || 50, 200);
    const where: any = { userId: req.user.userId };
    if (type) where.type = type;
    return this.transactionRepo.find({
      where,
      order: { createdAt: "DESC" },
      take,
    });
  }

  // ── My Predictions ────────────────────────────────────────────────────────

  @Get("me/bets")
  @ApiOperation({ summary: "Get my predictions (all bets)" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: PositionStatus,
    description: "Filter by bet status",
  })
  @ApiResponse({ status: 200, type: [PositionResponse] })
  getMyPositions(
    @Request() req: any,
    @Query("status") status?: PositionStatus,
  ) {
    const where: any = { userId: req.user.userId };
    if (status) where.status = status;
    return this.betRepo.find({
      where,
      relations: ["market", "outcome"],
      order: { placedAt: "DESC" },
    });
  }

  // ── Results: settled bets ─────────────────────────────────────────────────

  @Get("me/results")
  @ApiOperation({
    summary: "Get my results — bets that have been won, lost, or refunded",
  })
  @ApiResponse({ status: 200, type: [PositionResponse] })
  getResults(@Request() req: any) {
    return this.betRepo
      .createQueryBuilder("bet")
      .leftJoinAndSelect("bet.market", "market")
      .leftJoinAndSelect("bet.outcome", "outcome")
      .where("bet.userId = :userId", { userId: req.user.userId })
      .andWhere("bet.status IN (:...statuses)", {
        statuses: [
          PositionStatus.WON,
          PositionStatus.LOST,
          PositionStatus.REFUNDED,
        ],
      })
      .orderBy("bet.placedAt", "DESC")
      .getMany();
  }
}
