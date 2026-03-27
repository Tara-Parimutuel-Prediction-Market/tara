import { createHmac, createHash } from "crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { AuthMethod, AuthProvider } from "../entities/auth-method.entity";
import { Payment, PaymentMethod, PaymentStatus, PaymentType } from "../entities/payment.entity";
import { DKGatewayService } from "../payment/services/dk-gateway/dk-gateway.service";

export interface TelegramInitData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AuthMethod) private authMethodRepo: Repository<AuthMethod>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    private jwtService: JwtService,
    private dkGateway: DKGatewayService,
  ) {}

  // ── HMAC-SHA-256 Telegram initData validation ──────────────────────────────
  validateTelegramInitData(rawInitData: string): TelegramInitData {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new UnauthorizedException("Bot token not configured");

    const params = new URLSearchParams(rawInitData);
    const hash = params.get("hash");
    if (!hash) throw new UnauthorizedException("Missing hash in initData");

    // Build data-check string: sorted key=value pairs excluding hash and signature
    params.delete("hash");
    params.delete("signature"); // signature uses Ed25519, not part of HMAC check
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // HMAC-SHA-256 with secret_key = HMAC-SHA-256("WebAppData", botToken)
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const expectedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (expectedHash !== hash) {
      throw new UnauthorizedException("Invalid Telegram initData signature");
    }

    // Check freshness: reject if older than 24h
    const authDate = parseInt(params.get("auth_date") || "0", 10);
    if (Date.now() / 1000 - authDate > 86400) {
      throw new UnauthorizedException("initData is expired");
    }

    const userJson = params.get("user");
    if (!userJson) throw new UnauthorizedException("Missing user in initData");
    return { ...JSON.parse(userJson), auth_date: authDate, hash };
  }

  // ── Login / Register via Telegram ─────────────────────────────────────────
  async loginWithTelegram(rawInitData: string) {
    const tgUser = this.validateTelegramInitData(rawInitData);
    const providerId = String(tgUser.id);

    // Find or create auth method
    let authMethod = await this.authMethodRepo.findOne({
      where: { provider: AuthProvider.TELEGRAM, providerId },
      relations: ["user"],
    });

    if (!authMethod) {
      // New user
      const user = this.userRepo.create({
        telegramId: providerId,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        photoUrl: tgUser.photo_url,
      });
      await this.userRepo.save(user);

      // Seed 1000 starter credits as a ledger entry
      await this.paymentRepo.save(
        this.paymentRepo.create({
          type: PaymentType.DEPOSIT,
          status: PaymentStatus.SUCCESS,
          method: PaymentMethod.CREDITS,
          amount: 1000,
          currency: "CREDITS",
          description: "Starter credits",
          userId: user.id,
        }),
      );

      authMethod = this.authMethodRepo.create({
        provider: AuthProvider.TELEGRAM,
        providerId,
        metadata: tgUser,
        user,
        userId: user.id,
      });
      await this.authMethodRepo.save(authMethod);
    } else {
      // Update profile info
      await this.userRepo.update(authMethod.userId, {
        telegramId: providerId,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        photoUrl: tgUser.photo_url,
      });
    }

    const user =
      authMethod.user ||
      (await this.userRepo.findOneBy({ id: authMethod.userId }));
    const token = this.jwtService.sign({ sub: user.id, isAdmin: user.isAdmin });

    return { token, user };
  }

  // ── Login / Register via DK Bank CID ──────────────────────────────────────
  async loginWithDKBank(cid: string) {
    const account = await this.dkGateway.lookupAccountByCID(cid);

    let authMethod = await this.authMethodRepo.findOne({
      where: { provider: AuthProvider.DKBANK, providerId: account.accountNumber },
      relations: ["user"],
    });

    if (!authMethod) {
      // New user — create account linked to DK Bank identity
      const user = this.userRepo.create({
        firstName: account.accountName.split(" ")[0] || account.accountName,
        lastName: account.accountName.split(" ").slice(1).join(" ") || null,
        dkCid: cid,
        dkAccountNumber: account.accountNumber,
        dkAccountName: account.accountName,
      });
      await this.userRepo.save(user);

      // Seed 1000 starter credits as a ledger entry
      await this.paymentRepo.save(
        this.paymentRepo.create({
          type: PaymentType.DEPOSIT,
          status: PaymentStatus.SUCCESS,
          method: PaymentMethod.CREDITS,
          amount: 1000,
          currency: "CREDITS",
          description: "Starter credits",
          userId: user.id,
        }),
      );

      authMethod = this.authMethodRepo.create({
        provider: AuthProvider.DKBANK,
        providerId: account.accountNumber,
        metadata: { cid, accountName: account.accountName, phoneNumber: account.phoneNumber },
        user,
        userId: user.id,
      });
      await this.authMethodRepo.save(authMethod);
    } else {
      // Existing user — keep DK fields in sync
      await this.userRepo.update(authMethod.userId, {
        dkCid: cid,
        dkAccountNumber: account.accountNumber,
        dkAccountName: account.accountName,
      });
    }

    const user =
      authMethod.user ||
      (await this.userRepo.findOneBy({ id: authMethod.userId }));
    const token = this.jwtService.sign({ sub: user.id, isAdmin: user.isAdmin });

    return { token, user, dkAccount: account };
  }
}
