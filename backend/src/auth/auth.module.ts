import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { User } from "../entities/user.entity";
import { AuthMethod } from "../entities/auth-method.entity";
import { Payment } from "../entities/payment.entity";
import { Transaction } from "../entities/transaction.entity";
import { DKGatewayAuthToken } from "../entities/dk-gateway-auth-token.entity";
import { DKGatewayService } from "../payment/services/dk-gateway/dk-gateway.service";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuthMethod,
      Payment,
      Transaction,
      DKGatewayAuthToken,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_SECRET", "tara-secret"),
        signOptions: { expiresIn: config.get("JWT_EXPIRES_IN", "7d") },
      }),
    }),
    TelegramModule,
  ],
  providers: [AuthService, JwtStrategy, DKGatewayService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
