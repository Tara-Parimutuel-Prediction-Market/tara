import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Settlement } from "../entities/settlement.entity";
import { Bet } from "../entities/bet.entity";
import { User } from "../entities/user.entity";
import { Payment } from "../entities/payment.entity";
import { AdminController } from "./admin.controller";
import { MarketsModule } from "../markets/markets.module";
import { FixturesService } from "./fixtures.service";

@Module({
  imports: [TypeOrmModule.forFeature([Settlement, Bet, User, Payment]), MarketsModule],
  controllers: [AdminController],
  providers: [FixturesService],
})
export class AdminModule {}
