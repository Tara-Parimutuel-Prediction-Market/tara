import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards";
import { User } from "../entities/user.entity";
import { Payment, PaymentMethod, PaymentStatus } from "../entities/payment.entity";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get my profile & balance" })
  async getMe(@Request() req) {
    const user = await this.userRepo.findOne({
      where: { id: req.user.userId },
      select: ["id", "firstName", "lastName", "username", "photoUrl", "isAdmin", "createdAt"],
    });

    const rows: { method: string; balance: string }[] = await this.paymentRepo
      .createQueryBuilder("p")
      .select("p.method", "method")
      .addSelect("COALESCE(SUM(p.amount), 0)", "balance")
      .where("p.userId = :userId", { userId: req.user.userId })
      .andWhere("p.status = :status", { status: PaymentStatus.SUCCESS })
      .groupBy("p.method")
      .getRawMany();

    const bal = Object.fromEntries(rows.map((r) => [r.method, Number(r.balance)]));

    return {
      ...user,
      creditsBalance: bal[PaymentMethod.CREDITS] ?? 0,
      btnBalance: bal[PaymentMethod.DK_BANK] ?? 0,
      usdtBalance: bal[PaymentMethod.TON] ?? 0,
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
