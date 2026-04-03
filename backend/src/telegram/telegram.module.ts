import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Market } from "../entities/market.entity";
import { Bet } from "../entities/bet.entity";
import { AuthMethod } from "../entities/auth-method.entity";
import { Transaction } from "../entities/transaction.entity";
import { Payment } from "../entities/payment.entity";
import { DKGatewayAuthToken } from "../entities/dk-gateway-auth-token.entity";
import { TelegramSimpleService } from "./telegram.service.simple";
import { TelegramVerificationService } from "./telegram-verification.service";
import { BotController } from "../bot/bot.controller";
import { BotPollingService } from "../bot/bot-polling.service";
import { DKGatewayService } from "../payment/services/dk-gateway/dk-gateway.service";
import { TelegramChannelController } from "./telegram-channel.controller";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Market,
      Bet,
      AuthMethod,
      Transaction,
      Payment,
      DKGatewayAuthToken,
    ]),
  ],
  controllers: [BotController, TelegramChannelController],
  providers: [
    TelegramSimpleService,
    TelegramVerificationService,
    BotPollingService,
    DKGatewayService,
  ],
  exports: [TelegramSimpleService, TelegramVerificationService],
})
export class TelegramModule {}
