import { createHmac, timingSafeEqual } from "crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { AuthMethod, AuthProvider } from "../entities/auth-method.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { DKGatewayService } from "../payment/services/dk-gateway/dk-gateway.service";
import { TelegramVerificationService } from "../telegram/telegram-verification.service";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { AuditService } from "../admin/audit.service";
import { AuditAction } from "../entities/audit-log.entity";
import { RedisService } from "../redis/redis.service";

function stripSensitiveFields(
  user: User,
): Omit<User, "dkPhoneHash" | "telegramPhoneHash" | "phoneNumber"> {
  const {
    dkPhoneHash: _a,
    telegramPhoneHash: _b,
    phoneNumber: _c,
    ...safe
  } = user as any;
  return safe;
}

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(AuthMethod)
    private authMethodRepo: Repository<AuthMethod>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    private jwtService: JwtService,
    private dkGateway: DKGatewayService,
    private telegramVerification: TelegramVerificationService,
    private auditService: AuditService,
    private redis: RedisService,
    private telegramSimple: TelegramSimpleService,
  ) {}

  // ── HMAC-SHA-256 Telegram initData validation ──────────────────────────────
  validateTelegramInitData(rawInitData: string): TelegramInitData {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) throw new UnauthorizedException("Bot token not configured");
    this.logger.debug(
      `[Auth] Using bot token: id=${botToken.split(":")[0]} len=${botToken.length}`,
    );

    const params = new URLSearchParams(rawInitData);
    const hash = params.get("hash");
    if (!hash) throw new UnauthorizedException("Missing hash in initData");

    // Build data-check string: sorted key=value pairs excluding hash and signature
    params.delete("hash");
    // Note: signature IS included in the data-check string for newer bots
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

    const expectedBuf = Buffer.from(expectedHash);
    const receivedBuf = Buffer.from(hash);
    const hashValid =
      expectedBuf.length === receivedBuf.length &&
      timingSafeEqual(expectedBuf, receivedBuf);
    if (!hashValid) {
      this.logger.warn(
        `[Auth] initData hash mismatch.\n  Expected : ${expectedHash}\n  Got      : ${hash}\n  dataCheckString:\n${dataCheckString}\n  rawInitData (full): ${rawInitData}`,
      );
      throw new UnauthorizedException("Invalid Telegram initData signature");
    }

    // Check freshness: reject if older than 24h
    const authDate = parseInt(params.get("auth_date") || "0", 10);
    const ageSeconds = Math.floor(Date.now() / 1000 - authDate);
    if (ageSeconds > 86400) {
      this.logger.warn(`[Auth] initData expired — age: ${ageSeconds}s`);
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
      // Check if a user row already exists for this telegramId (orphaned — no auth_method yet)
      let user = await this.userRepo.findOneBy({ telegramId: providerId });

      if (!user) {
        // Brand new user
        user = this.userRepo.create({
          telegramId: providerId,
          telegramChatId: providerId,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          photoUrl: tgUser.photo_url,
        });
        await this.userRepo.save(user);

        // Dev-only seed credits — not available in staging or production
        if (process.env.NODE_ENV === "development") {
          await this.transactionRepo.save(
            this.transactionRepo.create({
              type: TransactionType.DEPOSIT,
              amount: 1000,
              balanceBefore: 0,
              balanceAfter: 1000,
              userId: user.id,
              note: "Starter credits",
            }),
          );
        }
      } else {
        // Orphaned user — sync telegramChatId
        await this.userRepo.update(user.id, { telegramChatId: providerId });
      }

      authMethod = this.authMethodRepo.create({
        provider: AuthProvider.TELEGRAM,
        providerId,
        metadata: tgUser,
        user,
        userId: user.id,
      });
      await this.authMethodRepo.save(authMethod);
    } else {
      // Update profile info + always sync telegramChatId
      // In Telegram private chats, chat_id === user_id, so telegramId IS the chatId.
      await this.userRepo.update(authMethod.userId, {
        telegramId: providerId,
        telegramChatId: providerId, // ← keep chat_id in sync on every login
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
        photoUrl: tgUser.photo_url,
      });
    }

    const freshUser = await this.userRepo.findOneBy({
      id: authMethod.user?.id ?? authMethod.userId,
    });
    // freshUser cannot be null here — user was just saved/updated above
    const token = this.jwtService.sign({
      sub: freshUser!.id,
      isAdmin: freshUser!.isAdmin,
    });

    // Log user login in audit log
    await this.auditService.log({
      adminId: freshUser!.id,
      username: freshUser!.username || freshUser!.firstName || "Unknown",
      isAdmin: freshUser!.isAdmin,
      action: AuditAction.USER_LOGIN,
      entityType: "user",
      entityId: freshUser!.id,
      meta: {
        provider: "telegram",
        telegramId: providerId,
        username: freshUser!.username,
      },
    });

    return { token, user: stripSensitiveFields(freshUser!) };
  }

  // ── Dev-only: login and ensure isAdmin=true ───────────────────────────────
  async ensureAdminAndLogin(rawInitData: string) {
    const result = await this.loginWithTelegram(rawInitData);
    const userId = result.user.id;
    if (!result.user.isAdmin) {
      await this.userRepo.update(userId, { isAdmin: true });
    }
    // Re-sign with isAdmin=true
    const freshUser = await this.userRepo.findOneBy({ id: userId });
    // freshUser cannot be null — user was just returned by loginWithTelegram
    const token = this.jwtService.sign({
      sub: freshUser!.id,
      isAdmin: freshUser!.isAdmin,
    });
    return { token, user: stripSensitiveFields(freshUser!) };
  }

  // ── Login / Register via DK Bank CID ──────────────────────────────────────
  /**
   * Links a DK Bank CID to a Tara account.
   *
   * @param cid - The 11-digit national ID.
   * @param callerUserId - When called from the TMA (already JWT-authenticated),
   *   pass the authenticated user's UUID so the DK fields + dkPhoneHash are
   *   written to that existing Telegram user row instead of creating a new one.
   */
  async loginWithDKBank(cid: string, callerUserId?: string) {
    const account = await this.dkGateway.lookupAccountByCID(cid);

    // ── If called by an already-authenticated Telegram user, merge into their row ──
    if (callerUserId) {
      const existingUser = await this.userRepo.findOneBy({ id: callerUserId });
      if (existingUser) {
        // ── Step 1: Clear the CID from any OTHER user row that already owns it ──
        // Must happen BEFORE writing to callerUserId due to the unique constraint on dkCid.
        const orphanByCid = await this.userRepo.findOneBy({ dkCid: cid });
        if (orphanByCid && orphanByCid.id !== callerUserId) {
          this.logger.log(
            `[Auth] Clearing dkCid/dkAccountNumber/dkPhoneHash from orphan user ${orphanByCid.id} before merging into ${callerUserId}`,
          );
          await this.userRepo.update(orphanByCid.id, {
            dkCid: null as any,
            dkAccountNumber: null as any,
            dkPhoneHash: null as any,
            phoneNumber: null as any,
          });
        }
        const orphanByAccount = await this.userRepo.findOneBy({
          dkAccountNumber: account.accountNumber,
        });
        if (orphanByAccount && orphanByAccount.id !== callerUserId) {
          await this.userRepo.update(orphanByAccount.id, {
            dkCid: null as any,
            dkAccountNumber: null as any,
            dkPhoneHash: null as any,
          });
        }

        // ── Step 2: Write DK fields onto the authenticated Telegram user row ──
        await this.userRepo.update(callerUserId, {
          dkCid: cid,
          dkAccountNumber: account.accountNumber,
          dkAccountName: account.accountName,
          phoneNumber: account.phoneNumber || null,
        });
        // Write dkPhoneHash onto the Telegram user row — this is the key step
        await this.telegramVerification.storeDKPhoneHash(
          callerUserId,
          account.phoneNumber,
        );

        // ── Step 3: Upsert the DKBANK auth method — always point it to callerUserId ──
        let dkAuthMethod = await this.authMethodRepo.findOne({
          where: {
            provider: AuthProvider.DKBANK,
            providerId: account.accountNumber,
          },
        });
        if (!dkAuthMethod) {
          dkAuthMethod = this.authMethodRepo.create({
            provider: AuthProvider.DKBANK,
            providerId: account.accountNumber,
            metadata: {
              cid,
              accountName: account.accountName,
            },
            user: existingUser,
            userId: callerUserId,
          });
          await this.authMethodRepo.save(dkAuthMethod);
        } else if (dkAuthMethod.userId !== callerUserId) {
          await this.authMethodRepo.update(dkAuthMethod.id, {
            userId: callerUserId,
          });
          this.logger.log(
            `[Auth] Repointed dkbank auth_method from orphan → ${callerUserId}`,
          );
        }

        const token = this.jwtService.sign({
          sub: existingUser.id,
          isAdmin: existingUser.isAdmin,
        });
        const updatedUser = await this.userRepo.findOneBy({ id: callerUserId });
        const { phoneNumber: _p1, ...safeDkAccount1 } = account;
        return {
          token,
          user: stripSensitiveFields(updatedUser!),
          dkAccount: safeDkAccount1,
        };
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    let authMethod = await this.authMethodRepo.findOne({
      where: {
        provider: AuthProvider.DKBANK,
        providerId: account.accountNumber,
      },
      relations: ["user"],
    });

    if (!authMethod) {
      // Guard: user row may already exist (linked via TMA) but auth_method missing
      let user = await this.userRepo.findOneBy({ dkCid: cid });
      if (!user) {
        user = await this.userRepo.findOneBy({
          dkAccountNumber: account.accountNumber,
        });
      }

      // Telegram user with a matching DK phone may already exist ──
      // This can happen if the Telegram login ran first (creating a row with telegramId
      // but no DK fields) and now the same person enters their CID without a JWT.
      // Hash the DK phone and look for a match so we merge into that row instead of
      // creating a duplicate.
      if (!user && account.phoneNumber) {
        const dkPhoneHash = this.telegramVerification.hashPhone(
          account.phoneNumber,
        );
        user = await this.userRepo.findOneBy({
          telegramPhoneHash: dkPhoneHash,
        });
        if (!user) {
          // Also check if there is a Telegram row whose dkPhoneHash was pre-seeded
          user = await this.userRepo.findOneBy({ dkPhoneHash });
        }
        if (user) {
          this.logger.log(
            `[Auth] Phone-hash match found user ${user.id} — merging DK data instead of creating duplicate`,
          );
        }
      }

      if (user) {
        // User row exists — just ensure fields are up to date and create the missing auth_method
        await this.userRepo.update(user.id, {
          dkCid: cid,
          dkAccountNumber: account.accountNumber,
          dkAccountName: account.accountName,
          phoneNumber: account.phoneNumber || null,
        });
        await this.telegramVerification.storeDKPhoneHash(
          user.id,
          account.phoneNumber,
        );
        authMethod = this.authMethodRepo.create({
          provider: AuthProvider.DKBANK,
          providerId: account.accountNumber,
          metadata: {
            cid,
            accountName: account.accountName,
            phoneNumber: account.phoneNumber,
          },
          user,
          userId: user.id,
        });
        await this.authMethodRepo.save(authMethod);
        const freshUser = await this.userRepo.findOneBy({ id: user.id });
        const token = this.jwtService.sign({
          sub: freshUser!.id,
          isAdmin: freshUser!.isAdmin,
        });
        const { phoneNumber: _p2, ...safeDkAccount2 } = account;
        return {
          token,
          user: stripSensitiveFields(freshUser!),
          dkAccount: safeDkAccount2,
        };
      }

      // Brand new user — create account linked to DK Bank identity
      user = this.userRepo.create({
        firstName: account.accountName.split(" ")[0] || account.accountName,
        lastName: account.accountName.split(" ").slice(1).join(" ") || null,
        dkCid: cid,
        dkAccountNumber: account.accountNumber,
        dkAccountName: account.accountName,
        phoneNumber: account.phoneNumber || null,
      });
      await this.userRepo.save(user);

      // Store DK phone hash for future Telegram phone verification
      await this.telegramVerification.storeDKPhoneHash(
        user.id,
        account.phoneNumber,
      );

      // Dev-only seed credits — not available in staging or production
      if (process.env.NODE_ENV === "development") {
        await this.transactionRepo.save(
          this.transactionRepo.create({
            type: TransactionType.DEPOSIT,
            amount: 1000,
            balanceBefore: 0,
            balanceAfter: 1000,
            userId: user.id,
            note: "Starter credits",
          }),
        );
      }

      authMethod = this.authMethodRepo.create({
        provider: AuthProvider.DKBANK,
        providerId: account.accountNumber,
        metadata: {
          cid,
          accountName: account.accountName,
          phoneNumber: account.phoneNumber,
        },
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
        phoneNumber: account.phoneNumber || null,
      });
      // Re-hash the DK phone in case the registered number changed
      await this.telegramVerification.storeDKPhoneHash(
        authMethod.userId,
        account.phoneNumber,
      );
    }

    const freshUser = await this.userRepo.findOneBy({
      id: authMethod.user?.id ?? authMethod.userId,
    });
    const token = this.jwtService.sign({
      sub: freshUser!.id,
      isAdmin: freshUser!.isAdmin,
    });

    const { phoneNumber: _p3, ...safeDkAccount3 } = account;
    return {
      token,
      user: stripSensitiveFields(freshUser!),
      dkAccount: safeDkAccount3,
    };
  }

  // ── Manual Login (Fallback when Telegram initData fails) ───────────────────

  /**
   * Step 1: Request OTP for manual login
   * Sends a 6-digit OTP to the user's Telegram ID via bot
   */
  async requestManualLoginOtp(telegramId: string, cid: string): Promise<void> {
    // Validate CID with DK Bank first
    const account = await this.dkGateway.lookupAccountByCID(cid);
    if (!account.phoneNumber) {
      throw new UnauthorizedException("DK Bank account has no phone number registered");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5-minute expiry
    const redisKey = `manual_login_otp:${telegramId}`;
    await this.redis.setJsonEx(redisKey, 300, {
      otp,
      cid,
      dkPhoneHash: this.telegramVerification.hashPhone(account.phoneNumber),
      attempts: 0,
    });

    // Send OTP to user's Telegram
    const message = `🔐 <b>Tara Manual Login</b>\n\nYour OTP: <code>${otp}</code>\n\nValid for 5 minutes. Do not share this code.\n\nIf you didn't request this, ignore this message.`;
    await this.telegramSimple.sendMessage(Number(telegramId), message);

    this.logger.log(`[ManualLogin] OTP sent to Telegram ID ${telegramId}`);
  }

  /**
   * Step 2: Verify OTP and complete manual login
   * Validates OTP and checks phone number matches DK Bank
   */
  async verifyManualLogin(
    telegramId: string,
    cid: string,
    otp: string,
    phoneNumber: string,
  ): Promise<{ token: string; user: Omit<User, "dkPhoneHash" | "telegramPhoneHash" | "phoneNumber"> }> {
    // Retrieve and validate OTP from Redis
    const redisKey = `manual_login_otp:${telegramId}`;
    const stored = await this.redis.getJson<{ otp: string; cid: string; dkPhoneHash: string; attempts: number }>(redisKey);

    if (!stored) {
      throw new UnauthorizedException("OTP expired or not found. Please request a new OTP.");
    }

    if (stored.cid !== cid) {
      throw new UnauthorizedException("CID mismatch. Please start the login process again.");
    }

    if (stored.otp !== otp) {
      stored.attempts++;
      if (stored.attempts >= 3) {
        await this.redis.del(redisKey);
        throw new UnauthorizedException("Too many failed attempts. Please request a new OTP.");
      }
      await this.redis.setJsonEx(redisKey, 300, { ...stored, attempts: stored.attempts });
      throw new UnauthorizedException(`Invalid OTP. ${3 - stored.attempts} attempts remaining.`);
    }

    // OTP is valid - now verify phone number matches DK Bank
    const providedPhoneHash = this.telegramVerification.hashPhone(phoneNumber);
    if (providedPhoneHash !== stored.dkPhoneHash) {
      await this.redis.del(redisKey);
      throw new UnauthorizedException(
        "Phone number does not match DK Bank registered number. " +
        "Please use the phone number linked to your DK Bank account."
      );
    }

    // Delete OTP from Redis (one-time use)
    await this.redis.del(redisKey);

    // Find or create user
    let user = await this.userRepo.findOneBy({ telegramId });

    if (!user) {
      // Check if there's an existing DK Bank user with matching phone hash
      user = await this.userRepo.findOneBy({ dkPhoneHash: stored.dkPhoneHash });

      if (user) {
        // Bind Telegram ID to existing DK-only account
        if (user.telegramId && user.telegramId !== telegramId) {
          throw new UnauthorizedException("This DK Bank account is already linked to a different Telegram account.");
        }
        await this.userRepo.update(user.id, { telegramId });
        user.telegramId = telegramId;
      } else {
        // Create new user with Telegram ID
        user = this.userRepo.create({
          telegramId,
          dkCid: cid,
        });
        await this.userRepo.save(user);
      }
    }

    // Ensure DK fields are synced
    const account = await this.dkGateway.lookupAccountByCID(cid);
    await this.userRepo.update(user.id, {
      dkCid: cid,
      dkAccountNumber: account.accountNumber,
      dkAccountName: account.accountName,
      phoneNumber: account.phoneNumber || null,
    });
    await this.telegramVerification.storeDKPhoneHash(user.id, account.phoneNumber);

    // Create/update auth method for Telegram
    let tgAuthMethod = await this.authMethodRepo.findOne({
      where: { provider: AuthProvider.TELEGRAM, providerId: telegramId },
      relations: ["user"],
    });

    if (!tgAuthMethod) {
      tgAuthMethod = this.authMethodRepo.create({
        provider: AuthProvider.TELEGRAM,
        providerId: telegramId,
        metadata: { manualLogin: true },
        user,
        userId: user.id,
      });
      await this.authMethodRepo.save(tgAuthMethod);
    }

    // Create/update auth method for DK Bank
    let dkAuthMethod = await this.authMethodRepo.findOne({
      where: { provider: AuthProvider.DKBANK, providerId: account.accountNumber },
      relations: ["user"],
    });

    if (!dkAuthMethod) {
      dkAuthMethod = this.authMethodRepo.create({
        provider: AuthProvider.DKBANK,
        providerId: account.accountNumber,
        metadata: { cid, accountName: account.accountName },
        user,
        userId: user.id,
      });
      await this.authMethodRepo.save(dkAuthMethod);
    }

    // Store phone hashes for verification
    await this.userRepo.update(user.id, {
      telegramPhoneHash: providedPhoneHash,
      telegramChatId: telegramId,
      telegramLinkedAt: new Date(),
    });

    const freshUser = await this.userRepo.findOneBy({ id: user.id });
    if (!freshUser) {
      throw new UnauthorizedException("User creation failed");
    }

    // Generate JWT
    const token = this.jwtService.sign({
      sub: freshUser.id,
      isAdmin: freshUser.isAdmin,
    });

    // Log the login
    await this.auditService.log({
      adminId: freshUser.id,
      username: freshUser.username || freshUser.firstName || telegramId,
      isAdmin: freshUser.isAdmin,
      action: AuditAction.USER_LOGIN,
      entityType: "user",
      entityId: freshUser.id,
      meta: {
        provider: "manual",
        telegramId,
        cid,
      },
    });

    this.logger.log(`[ManualLogin] User ${freshUser.id} logged in successfully via manual flow`);

    return { token, user: stripSensitiveFields(freshUser) };
  }
}
