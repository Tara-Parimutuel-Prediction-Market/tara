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
import { Bet, BetStatus } from "../entities/bet.entity";
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
  @ApiProperty({ enum: TransactionType, example: TransactionType.BET_PLACED })
  type: TransactionType;
  @ApiProperty({
    example: -100.0,
    description: "Negative = debit, positive = credit",
  })
  amount: number;
  @ApiProperty({ example: 1600.0 }) balanceBefore: number;
  @ApiProperty({ example: 1500.0 }) balanceAfter: number;
  @ApiPropertyOptional({ example: "Bet on outcome: Team A" }) note: string;
  @ApiPropertyOptional({ example: "uuid-bet" }) betId: string;
  @ApiPropertyOptional({ example: "uuid-payment" }) paymentId: string;
  @ApiProperty() createdAt: Date;
}

class BetResponse {
  @ApiProperty({ example: "uuid-bet" }) id: string;
  @ApiProperty({ example: 100.0 }) amount: number;
  @ApiProperty({ enum: BetStatus, example: BetStatus.PENDING })
  status: BetStatus;
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
    @InjectRepository(Bet) private betRepo: Repository<Bet>,
    private readonly redis: RedisService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get my profile & balance" })
  @ApiResponse({ status: 200, type: ProfileResponse })
  async getMe(@Request() req) {
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
        // hashes loaded only for boolean derivation — never forwarded to client
        "dkPhoneHash",
        "telegramPhoneHash",
      ],
    });

    const balanceCacheKey = `tara:cache:balance:${userId}`;
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
      isPhoneVerified: !!(telegramPhoneHash && dkPhoneHash && telegramPhoneHash === dkPhoneHash),
    };
  }

  @Get("me/payments")
  @ApiOperation({ summary: "Get my payment history" })
  getPayments(@Request() req) {
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
    @Request() req,
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
    enum: BetStatus,
    description: "Filter by bet status",
  })
  @ApiResponse({ status: 200, type: [BetResponse] })
  getMyBets(@Request() req, @Query("status") status?: BetStatus) {
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
  @ApiResponse({ status: 200, type: [BetResponse] })
  getResults(@Request() req) {
    return this.betRepo
      .createQueryBuilder("bet")
      .leftJoinAndSelect("bet.market", "market")
      .leftJoinAndSelect("bet.outcome", "outcome")
      .where("bet.userId = :userId", { userId: req.user.userId })
      .andWhere("bet.status IN (:...statuses)", {
        statuses: [BetStatus.WON, BetStatus.LOST, BetStatus.REFUNDED],
      })
      .orderBy("bet.placedAt", "DESC")
      .getMany();
  }
}
