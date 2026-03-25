import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Market } from "../entities/market.entity";
import { Outcome } from "../entities/outcome.entity";
import { Bet } from "../entities/bet.entity";
import { Payment } from "../entities/payment.entity";
import { Settlement } from "../entities/settlement.entity";
import { User } from "../entities/user.entity";
import { MarketsService } from "./markets.service";
import { MarketsController } from "./markets.controller";
import { ParimutuelEngine } from "./parimutuel.engine";
import { LMSRService } from "./lmsr.service";
import { SCPMService } from "./scpm.service";
import { KeeperService } from "./keeper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Market,
      Outcome,
      Bet,
      Payment,
      Settlement,
      User,
    ]),
  ],
  providers: [MarketsService, ParimutuelEngine, LMSRService, SCPMService, KeeperService],
  controllers: [MarketsController],
  exports: [MarketsService, ParimutuelEngine, SCPMService],
})
export class MarketsModule {}
