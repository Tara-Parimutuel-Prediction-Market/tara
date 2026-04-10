import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { MarketsModule } from "./markets/markets.module";
import { PositionsModule } from "./positions/positions.module";
import { AdminModule } from "./admin/admin.module";
import { TelegramModule } from "./telegram/telegram.module";
import { PaymentModule } from "./payment/payment.module";
import { RedisModule } from "./redis/redis.module";
import { JobsModule } from "./jobs/jobs.module";
import { User } from "./entities/user.entity";
import { AuthMethod } from "./entities/auth-method.entity";
import { Market } from "./entities/market.entity";
import { Outcome } from "./entities/outcome.entity";
import { Position } from "./entities/position.entity";
import { Payment } from "./entities/payment.entity";
import { Transaction } from "./entities/transaction.entity";
import { Settlement } from "./entities/settlement.entity";
import { Dispute } from "./entities/dispute.entity";
import { DKGatewayAuthToken } from "./entities/dk-gateway-auth-token.entity";
import { PaymentOtp } from "./entities/payment-otp.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { ReportingModule } from "./reporting/reporting.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("REDIS_URL", "redis://localhost:6379");
        // Parse host/port from URL for BullMQ connection config
        const parsed = new URL(url);
        return {
          connection: {
            host: parsed.hostname || "localhost",
            port: parseInt(parsed.port || "6379", 10),
            password: parsed.password || undefined,
          },
        };
      },
    }),
    JobsModule,
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
          Position,
          Payment,
          Transaction,
          Settlement,
          Dispute,
          DKGatewayAuthToken,
          PaymentOtp,
          AuditLog,
        ],
        synchronize: false,
        logging: false,
        extra: {
          max: 5,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
    AuthModule,
    UsersModule,
    MarketsModule,
    PositionsModule,
    AdminModule,
    TelegramModule,
    PaymentModule,
    ReportingModule,
  ],
})
export class AppModule {}
