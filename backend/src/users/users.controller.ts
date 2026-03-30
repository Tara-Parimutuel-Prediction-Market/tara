import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards";
import { User } from "../entities/user.entity";
import { Payment } from "../entities/payment.entity";
import { Transaction } from "../entities/transaction.entity";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get my profile & balance" })
  async getMe(@Request() req) {
    const user = await this.userRepo.findOne({
      where: { id: req.user.userId },
      select: ["id", "firstName", "lastName", "username", "photoUrl", "isAdmin", "createdAt"],
    });

    const { creditsBalance } = await this.transactionRepo
      .createQueryBuilder("t")
      .select("COALESCE(SUM(t.amount), 0)", "creditsBalance")
      .where("t.userId = :userId", { userId: req.user.userId })
      .getRawOne();

    return {
      ...user,
      creditsBalance: Number(creditsBalance),
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
}
