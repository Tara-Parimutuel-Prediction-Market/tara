import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../entities/user.entity'
import { Market } from '../entities/market.entity'
import { Bet } from '../entities/bet.entity'
import { TelegramSimpleService } from './telegram.service.simple'
import { BotController } from '../bot/bot.controller'

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TypeOrmModule.forFeature([User, Market, Bet])
  ],
  controllers: [BotController],
  providers: [TelegramSimpleService],
  exports: [TelegramSimpleService]
})
export class TelegramModule {}
