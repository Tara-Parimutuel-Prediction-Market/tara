import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { MarketsModule } from "./markets/markets.module";
import { BetsModule } from "./bets/bets.module";
import { AdminModule } from "./admin/admin.module";
import { User } from "./entities/user.entity";
import { AuthMethod } from "./entities/auth-method.entity";
import { Market } from "./entities/market.entity";
import { Outcome } from "./entities/outcome.entity";
import { Bet } from "./entities/bet.entity";
import { Transaction } from "./entities/transaction.entity";
import { Settlement } from "./entities/settlement.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.get("DB_USERNAME", "postgres"),
        password: config.get("DB_PASSWORD", "postgres"),
        database: config.get("DB_NAME", "tara_db"),
        entities: [
          User,
          AuthMethod,
          Market,
          Outcome,
          Bet,
          Transaction,
          Settlement,
        ],
        synchronize: config.get("DB_SYNC", "true") === "true",
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
    MarketsModule,
    BetsModule,
    AdminModule,
  ],
})
export class AppModule {}
