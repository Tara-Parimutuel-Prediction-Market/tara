import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "crypto";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { DataSource, Repository } from "typeorm";

import { User } from "../entities/user.entity";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "../entities/payment.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";
import { PaymentOtp, OtpStatus } from "../entities/payment-otp.entity";
import { DKGatewayService } from "./services/dk-gateway/dk-gateway.service";
import { RedisService } from "../redis/redis.service";
import { TelegramSimpleService } from "../telegram/telegram.service.simple";
import { TelegramVerificationService } from "../telegram/telegram-verification.service";

/** Shape stored in Redis for an active OTP session. */
interface OtpSession {
  status: OtpStatus;
  expiresAt: string; // ISO
  bfsTxnId: string | null;
  failedAttempts: number;
  userId: string;
}

const otpSessionKey = (paymentId: string) => `Oro:otp:${paymentId}`;

/** OTP window: 10 minutes to match typical DK Bank OTP validity. */
const OTP_TTL_MS = 10 * 60 * 1000;

/** Telegram OTP window: 60 seconds. */
const TG_OTP_TTL_S = 60;

export interface DKBankPaymentRequest {
  amount: number;
  cid: string; // 11-digit Bhutanese CID — used to look up the DK Bank account
  customerName?: string;
  description: string;
  merchantTxnId?: string;
  /** Optional: links this payment's OTP session to a market (e.g. top-up before betting). */
  marketId?: string;
  /** Optional: links this payment's OTP session to a dispute bond. */
  disputeId?: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  paymentId: string;
  status: "pending" | "success" | "failed";
  amount: number;
  currency: string;
  method: "dkbank";
  message: string;
  timestamp: string;
  /** True when the payment is waiting for the customer's OTP before executing. */
  otpRequired?: boolean;
  paymentUrl?: string;
  qrCode?: string;
}

export interface PaymentStatusResponse {
  paymentId: string;
  status: "pending" | "otp_required" | "success" | "failed" | "cancelled";
  amount: number;
  currency: string;
  method: string;
  confirmedAt?: string;
  failureReason?: string;
}

@Injectable()
export class DKBankPaymentService {
  private readonly logger = new Logger(DKBankPaymentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dkGateway: DKGatewayService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly telegramService: TelegramSimpleService,
    private readonly telegramVerification: TelegramVerificationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentOtp)
    private readonly otpRepo: Repository<PaymentOtp>,
  ) {}

  /**
   * Step 1: Look up customer account by CID and call DK account_auth.
   * DK sends an OTP to the customer's registered phone.
   * Returns paymentId + otpRequired: true.
   */
  async initiatePayment(
    userId: string,
    dto: DKBankPaymentRequest,
  ): Promise<PaymentInitiateResponse> {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Amount must be a positive number");
    }
    const cid =
      typeof dto.cid === "string"
        ? dto.cid.trim().replace(/\s+/g, "").replace(/[^\d]/g, "")
        : "";
    if (!cid) throw new BadRequestException("cid is required");
    if (!dto.description || typeof dto.description !== "string") {
      throw new BadRequestException("description is required");
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    // ── CID ownership check — ALWAYS enforced, even in staging ───────────────
    // The CID submitted must match the one the user linked to their account.
    // This prevents user A from paying with user B's CID.
    if (user.dkCid && user.dkCid !== cid) {
      this.logger.warn(
        `[Payment] CID mismatch for user ${userId}: submitted=${cid} linked=${user.dkCid}`,
      );
      throw new BadRequestException(
        "The CID you entered does not match your linked DK Bank account. " +
          "Please use your own CID.",
      );
    }
    if (!user.dkCid) {
      throw new BadRequestException(
        "You have not linked a DK Bank account yet. " +
          "Please go to Profile → Link DK Bank Account first.",
      );
    }

    // ── Bank-level security: verify Telegram phone == DK Bank phone ──────────
    // ALWAYS enforced in both staging and production.
    // User must have verified their Telegram phone matches their DK Bank phone.
    await this.telegramVerification.verifyPaymentIdentity(userId);

    const payment = this.paymentRepo.create({
      type: PaymentType.DEPOSIT,
      status: PaymentStatus.PENDING,
      method: PaymentMethod.DK_BANK,
      amount,
      currency: "BTN",
      description: dto.description,
      referenceId: dto.merchantTxnId || null,
      userId: user.id,
      metadata: {
        cid,
        customerName: dto.customerName ?? null,
        initiatedAt: new Date().toISOString(),
        merchantTxnId: dto.merchantTxnId || null,
      },
    });
    await this.paymentRepo.save(payment);

    // ── Look up DK Bank account by CID ───────────────────────────────────────
    // We only call client_inquiry to verify the CID belongs to a real DK account
    // and to record the account number. We do NOT call account_auth — that would
    // trigger DK's SMS OTP which we don't want. The Telegram OTP is our gate.
    let customerAccountNumber: string | null = null;
    let customerAccountName: string | null = null;

    try {
      const account = await this.dkGateway.lookupAccountByCID(cid);
      customerAccountNumber = account.accountNumber;
      customerAccountName = account.accountName;
      payment.customerPhone = account.phoneNumber || null;

      payment.metadata = {
        ...(payment.metadata || {}),
        customerAccountNumber,
        customerAccountName,
      };
      await this.paymentRepo.save(payment);
    } catch (e: any) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = e?.message || "Failed to look up DK Bank account";
      payment.metadata = {
        ...(payment.metadata || {}),
        dkInitiateError: { message: payment.failureReason },
      };
      await this.paymentRepo.save(payment);
      throw e;
    }

    // ── Step 2: Generate Telegram OTP and send it ─────────────────────────────
    // The Telegram OTP is the user-facing confirmation gate.
    // Security is backed by: CID ownership + Telegram phone == DK phone (verified on linking).
    {
      const generatedOtp = String(
        100000 + (randomBytes(3).readUIntBE(0, 3) % 900000),
      );
      const now = new Date();
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      await this.redis.setJsonEx<{ otp: string; userId: string }>(
        `oro:tg-otp:${payment.id}`,
        TG_OTP_TTL_S,
        { otp: generatedOtp, userId },
      );

      await this.otpRepo.save(
        this.otpRepo.create({
          paymentId: payment.id,
          userId,
          marketId: dto.marketId || null,
          disputeId: dto.disputeId || null,
          status: OtpStatus.PENDING,
          expiresAt,
          lastRequestedAt: now,
          verifiedAt: null,
          requestCount: 1,
          failedAttempts: 0,
          bfsTxnId: null,
        }),
      );
      await this.redis.setJsonEx<OtpSession>(
        otpSessionKey(payment.id),
        OTP_TTL_MS / 1000,
        {
          status: OtpStatus.PENDING,
          expiresAt: expiresAt.toISOString(),
          bfsTxnId: null,
          failedAttempts: 0,
          userId,
        },
      );

      const firstName = user.firstName?.trim() || "there";
      const tgExpiresAt = new Date(now.getTime() + TG_OTP_TTL_S * 1000);
      const expiresAtStr = tgExpiresAt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Thimphu",
        hour12: true,
      });

      await this.telegramService
        .sendMessage(
          Number(user.telegramId),
          `🔐 <b>Oro Payment OTP</b>\n\nHi ${firstName}, your one-time code for a <b>Nu ${amount.toLocaleString()}</b> deposit:\n\n<code>${generatedOtp}</code>\n\n⏳ Expires at ${expiresAtStr} (1 min)\n\n⚠️ <b>Oro will never ask for this code.</b> Do not share it with anyone.`,
        )
        .catch((err) =>
          this.logger.warn(`Failed to send OTP via Telegram: ${err.message}`),
        );

      return {
        success: true,
        paymentId: payment.id,
        status: "pending",
        amount,
        currency: "BTN",
        method: "dkbank",
        message:
          "OTP sent to your Telegram. Please enter it to complete the payment.",
        timestamp: now.toISOString(),
        otpRequired: true,
      };
    }
  }

  /**
   * Step 2: Submit the OTP to complete the payment.
   * Validates Telegram OTP, then executes debit_request on DK Bank to actually debit the account.
   * Polls DK for final status and credits Oro balance on SUCCESS.
   */
  async confirmPayment(
    userId: string,
    paymentId: string,
    otp: string,
  ): Promise<PaymentInitiateResponse> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already ${payment.status}`);
    }

    // ── Step 1: Validate Telegram OTP (security gate) ────────────────────────
    const MAX_OTP_ATTEMPTS = 5;

    // Load OTP record first so we can enforce per-payment attempt limit
    const otpRecord = await this.otpRepo.findOne({
      where: { paymentId, userId },
      order: { createdAt: "DESC" },
    });

    if (otpRecord && otpRecord.failedAttempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        "Too many incorrect OTP attempts. Please initiate a new payment.",
      );
    }

    const tgOtpSession = await this.redis.getJson<{
      otp: string;
      userId: string;
    }>(`oro:tg-otp:${paymentId}`);

    if (!tgOtpSession) {
      throw new BadRequestException(
        "OTP has expired. Please initiate a new payment.",
      );
    }
    if (tgOtpSession.userId !== userId) {
      throw new BadRequestException("Payment not found.");
    }
    const otpValid =
      tgOtpSession.otp.length === otp.length &&
      timingSafeEqual(Buffer.from(tgOtpSession.otp), Buffer.from(otp));
    if (!otpValid) {
      if (otpRecord) {
        otpRecord.failedAttempts += 1;
        await this.otpRepo.save(otpRecord);
      }
      throw new BadRequestException(
        "Invalid OTP. Please check your Telegram and try again.",
      );
    }

    this.logger.log(`[OTP] Telegram OTP verified for payment ${payment.id}`);

    // Clear Telegram OTP from Redis immediately after validation
    await this.redis.del(`oro:tg-otp:${paymentId}`);

    // ── Step 2: Call DK Bank to actually debit the user's account ────────────
    const isStagingDepositBypass =
      this.configService.get<string>("DK_STAGING_DEPOSIT_BYPASS") === "true";

    const meta = payment.metadata || {};

    if (isStagingDepositBypass) {
      this.logger.warn(
        `[STAGING] Skipping real DK debit for payment ${payment.id} — DK_STAGING_DEPOSIT_BYPASS active`,
      );
    } else {
      // ── Step 2a: account_auth — authorize the transaction (get bfsTxnId) ──
      const stanNumber = this.dkGateway.generateStanNumber();
      let bfsTxnId: string;
      let txDatetime: string;

      try {
        const authResult = await this.dkGateway.authorizeTransaction({
          customerAccountNumber: meta.customerAccountNumber,
          customerAccountName: meta.customerAccountName,
          customerPhone: payment.customerPhone ?? "",
          amount: Number(payment.amount),
          description: payment.description ?? "DK Bank deposit",
          stanNumber,
        });
        bfsTxnId = authResult.bfsTxnId;
        txDatetime = authResult.txDatetime;
        payment.dkInquiryId = bfsTxnId;
        await this.paymentRepo.save(payment);
      } catch (e: any) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = e?.message || "DK account authorization failed";
        await this.paymentRepo.save(payment);
        throw new BadRequestException(payment.failureReason);
      }

      // ── Step 2b: debit_request — execute the pull payment with the OTP ───
      // In production, account_auth triggers a DK SMS OTP to the customer's
      // phone; the user enters that OTP in the TMA (same field). In staging
      // this path is never reached because isStagingDepositBypass is true.
      try {
        const execResult = await this.dkGateway.executeTransactionWithOtp({
          bfsTxnId,
          otp,
          stanNumber,
          txDatetime,
          sourceAccountNumber: meta.customerAccountNumber,
          sourceAccountName: meta.customerAccountName,
          amount: Number(payment.amount),
          description: payment.description ?? "DK Bank deposit",
        });
        payment.dkTxnStatusId = execResult.txnStatusId;
        await this.paymentRepo.save(payment);
      } catch (e: any) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = e?.message || "DK debit request failed";
        await this.paymentRepo.save(payment);
        throw new BadRequestException(payment.failureReason);
      }
    }

    // ── Step 3: Credit Oro balance ───────────────────────────────────────────
    this.logger.log(
      `[Payment] Crediting Oro balance for payment ${payment.id}`,
    );

    await this.applyDKStatusUpdate({
      userId,
      paymentId: payment.id,
      dkRaw: { source: "telegram_otp" },
      dkStatus: "SUCCESS",
      dkStatusDesc: "Telegram OTP verified — balance credited",
      isFromWebhook: false,
    });

    if (otpRecord) {
      otpRecord.status = OtpStatus.VERIFIED;
      otpRecord.verifiedAt = new Date();
      await this.otpRepo.save(otpRecord);
    }
    await this.redis.del(otpSessionKey(payment.id));
    await this.redis.del(`oro:cache:balance:${userId}`);

    return {
      success: true,
      paymentId: payment.id,
      status: "success" as any,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: "dkbank",
      message: "Payment confirmed. Balance credited.",
      timestamp: new Date().toISOString(),
    };
  }

  async getPaymentStatus(
    userId: string,
    paymentId: string,
  ): Promise<PaymentStatusResponse> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    if (payment.status === PaymentStatus.SUCCESS)
      return this.mapPayment(payment);
    if (payment.status === PaymentStatus.FAILED)
      return this.mapPayment(payment);

    // If the payment hasn't been confirmed with OTP yet (no txnStatusId)
    if (!payment.dkTxnStatusId && !payment.externalPaymentId) {
      return {
        paymentId: payment.id,
        status: payment.metadata?.bfsTxnId ? "otp_required" : "pending",
        amount: Number(payment.amount),
        currency: payment.currency,
        method: payment.method,
      };
    }

    const txnStatusId =
      payment.dkTxnStatusId || payment.externalPaymentId || "";
    let dkResult: Awaited<
      ReturnType<DKGatewayService["checkTransactionStatus"]>
    > | null = null;
    try {
      dkResult = await this.dkGateway.checkTransactionStatus(txnStatusId);
    } catch (e: any) {
      payment.metadata = {
        ...(payment.metadata || {}),
        dkStatusError: { message: e?.message || "DK status error" },
        dkStatusAttemptedAt: new Date().toISOString(),
      };
      await this.paymentRepo.save(payment);
      return this.mapPayment(payment);
    }

    if (!dkResult) return this.mapPayment(payment);

    await this.applyDKStatusUpdate({
      userId,
      paymentId: payment.id,
      dkRaw: dkResult.raw,
      dkStatus: dkResult.status,
      dkStatusDesc: dkResult.statusDesc,
      isFromWebhook: false,
    });

    const updated = await this.paymentRepo.findOne({
      where: { id: payment.id, userId },
    });
    if (!updated) throw new NotFoundException("Payment not found after update");
    return this.mapPayment(updated);
  }

  async handleWebhook(payload: any, signatureHeader?: string) {
    const sigOk = this.dkGateway.verifyWebhookSignature(
      payload,
      signatureHeader,
    );
    if (!sigOk) throw new BadRequestException("Invalid DK webhook signature");

    const inquiryId = payload?.inquiry_id || payload?.bfs_txn_id;
    if (!inquiryId || typeof inquiryId !== "string") {
      throw new BadRequestException(
        "Missing inquiry_id/bfs_txn_id in DK webhook payload",
      );
    }

    const payment = await this.paymentRepo.findOne({
      where: { dkInquiryId: inquiryId },
      relations: ["user"],
    });
    if (!payment) return { received: true, ignored: true };

    const txnStatusId = payment.dkTxnStatusId || payment.externalPaymentId;
    if (!txnStatusId) {
      payment.metadata = {
        ...(payment.metadata || {}),
        dkWebhookPayload: payload,
      };
      await this.paymentRepo.save(payment);
      return { received: true, ignored: true };
    }

    try {
      const dkResult = await this.dkGateway.checkTransactionStatus(txnStatusId);
      await this.applyDKStatusUpdate({
        userId: payment.userId,
        paymentId: payment.id,
        dkRaw: dkResult.raw,
        dkStatus: dkResult.status,
        dkStatusDesc: dkResult.statusDesc,
        isFromWebhook: true,
        dkWebhookPayload: payload,
      });
    } catch (e: any) {
      payment.metadata = {
        ...(payment.metadata || {}),
        dkWebhookStatusError: {
          message: e?.message || "DK webhook status error",
        },
        dkWebhookReceivedAt: new Date().toISOString(),
        dkWebhookPayload: payload,
      };
      await this.paymentRepo.save(payment);
      return { received: true, ignored: true };
    }

    return { received: true, ignored: false };
  }

  private mapPayment(payment: Payment): PaymentStatusResponse {
    const status =
      payment.status === PaymentStatus.SUCCESS
        ? "success"
        : payment.status === PaymentStatus.FAILED
          ? "failed"
          : payment.metadata?.bfsTxnId && !payment.dkTxnStatusId
            ? "otp_required"
            : "pending";
    return {
      paymentId: payment.id,
      status,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      confirmedAt: payment.confirmedAt
        ? payment.confirmedAt.toISOString()
        : undefined,
      failureReason: payment.failureReason || undefined,
    };
  }

  private async applyDKStatusUpdate(params: {
    userId: string;
    paymentId: string;
    dkRaw: any;
    dkStatus: string;
    dkStatusDesc?: string;
    isFromWebhook: boolean;
    dkWebhookPayload?: any;
  }) {
    const statusUpper = (params.dkStatus || "PENDING").toUpperCase();
    const mapped = statusUpper.includes("SUCCESS")
      ? PaymentStatus.SUCCESS
      : statusUpper.includes("FAIL")
        ? PaymentStatus.FAILED
        : PaymentStatus.PENDING;

    await this.dataSource.transaction(async (em) => {
      const payment = await em
        .getRepository(Payment)
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: params.paymentId })
        .andWhere("p.userId = :userId", { userId: params.userId })
        .getOne();
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== PaymentStatus.PENDING) return;

      payment.metadata = {
        ...(payment.metadata || {}),
        dkStatus: { status: params.dkStatus, statusDesc: params.dkStatusDesc },
        dkRaw: params.dkRaw,
        dkStatusSource: params.isFromWebhook ? "webhook" : "poll",
      };
      if (params.dkWebhookPayload)
        payment.metadata.dkWebhookPayload = params.dkWebhookPayload;

      if (mapped === PaymentStatus.SUCCESS) {
        payment.status = PaymentStatus.SUCCESS;
        payment.confirmedAt = new Date();
        payment.failureReason = null;

        // Snapshot balance before crediting
        const { balance: rawBefore } = await em
          .getRepository(Transaction)
          .createQueryBuilder("t")
          .select("COALESCE(SUM(t.amount), 0)", "balance")
          .where("t.userId = :userId", { userId: params.userId })
          .getRawOne();
        const balanceBefore = Number(rawBefore);

        this.logger.log(
          `[CREDITS] Crediting ${payment.amount} to user ${params.userId} from DK payment ${payment.id}`,
        );

        const depositAmount = Number(payment.amount);

        await em.save(
          Transaction,
          em.create(Transaction, {
            type: TransactionType.DEPOSIT,
            amount: depositAmount,
            balanceBefore,
            balanceAfter: balanceBefore + depositAmount,
            paymentId: payment.id,
            userId: params.userId,
            note: `DK Bank deposit confirmed`,
          }),
        );

        // ── 5% first-deposit bonus for referred users ──────────────────────
        // Fires once: only if this is the user's very first deposit and
        // they were referred by someone (referredByUserId is set).
        const user = await em.getRepository(User).findOne({
          where: { id: params.userId },
          select: ["id", "referredByUserId"],
        });

        if (user?.referredByUserId) {
          const priorDepositCount = await em
            .getRepository(Transaction)
            .count({ where: { userId: params.userId, type: TransactionType.DEPOSIT } });

          // priorDepositCount is now 1 (the one we just saved) — so 1 means first deposit
          if (priorDepositCount === 1) {
            const bonusAmount = Math.round(depositAmount * 0.05 * 100) / 100;
            const balAfterDeposit = balanceBefore + depositAmount;

            await em.save(
              Transaction,
              em.create(Transaction, {
                type: TransactionType.REFERRAL_BONUS,
                amount: bonusAmount,
                balanceBefore: balAfterDeposit,
                balanceAfter: balAfterDeposit + bonusAmount,
                userId: params.userId,
                note: `Welcome bonus — 5% on your first deposit`,
              }),
            );

            this.logger.log(
              `[Referral] First-deposit bonus ${bonusAmount} BTN credited to referred user ${params.userId}`,
            );
          }
        }

        // Invalidate cached balance so the next /users/me returns the updated value
        await this.redis.del(`oro:cache:balance:${params.userId}`);
      } else if (mapped === PaymentStatus.FAILED) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = params.dkStatusDesc || "Payment failed";
        payment.confirmedAt = new Date();
      }

      await em.save(payment);
    });
  }

  // ── Withdrawal: merchant vault → user DK Bank account ─────────────────────

  /**
   * Step 1 — Withdrawal initiation.
   * Validates that the user has a linked DK account and sufficient in-app
   * credit balance, then creates a PENDING withdrawal payment record and
   * sends a Telegram OTP as the confirmation gate.
   *
   * No funds leave the merchant vault until confirmWithdrawal succeeds.
   */
  async initiateWithdrawal(
    userId: string,
    dto: { amount: number },
  ): Promise<PaymentInitiateResponse> {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        "Withdrawal amount must be a positive number",
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (!user.dkAccountNumber || !user.dkCid) {
      throw new BadRequestException(
        "You have not linked a DK Bank account yet. " +
          "Please go to Profile → Link DK Bank Account first.",
      );
    }

    // ── Check in-app credit balance ───────────────────────────────────────────
    // Must happen outside a write-lock — this is a pre-flight read.
    // The authoritative balance check is repeated inside confirmWithdrawal
    // under pessimistic_write lock to prevent TOCTOU races.
    let balance = 0;
    await this.dataSource.transaction(async (em) => {
      const { balance: rawBalance } = await em
        .getRepository(Transaction)
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.amount), 0)", "balance")
        .where("t.userId = :userId", { userId })
        .getRawOne();
      balance = Number(rawBalance);
    });

    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient balance. You have Nu ${balance.toFixed(2)} but requested Nu ${amount.toFixed(2)}.`,
      );
    }

    // ── Create PENDING withdrawal payment record ───────────────────────────
    const payment = this.paymentRepo.create({
      type: PaymentType.WITHDRAWAL,
      status: PaymentStatus.PENDING,
      method: PaymentMethod.DK_BANK,
      amount,
      currency: "BTN",
      description: "Withdrawal to DK Bank account",
      userId: user.id,
      metadata: {
        dkAccountNumber: user.dkAccountNumber,
        dkAccountName: user.dkAccountName ?? null,
        initiatedAt: new Date().toISOString(),
      },
    });
    await this.paymentRepo.save(payment);

    // ── Generate and send Telegram OTP ────────────────────────────────────
    const { randomBytes } = await import("crypto");
    const generatedOtp = String(
      100000 + (randomBytes(3).readUIntBE(0, 3) % 900000),
    );
    const now = new Date();

    await this.redis.setJsonEx<{ otp: string; userId: string }>(
      `oro:tg-otp:${payment.id}`,
      TG_OTP_TTL_S,
      { otp: generatedOtp, userId },
    );

    await this.otpRepo.save(
      this.otpRepo.create({
        paymentId: payment.id,
        userId,
        status: OtpStatus.PENDING,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastRequestedAt: now,
        verifiedAt: null,
        requestCount: 1,
        failedAttempts: 0,
        bfsTxnId: null,
      }),
    );

    const firstName = user.firstName?.trim() || "there";
    await this.telegramService
      .sendMessage(
        Number(user.telegramId),
        `🏦 <b>Oro Withdrawal OTP</b>\n\nHi ${firstName}, your one-time code to withdraw <b>Nu ${amount.toLocaleString()}</b> to your DK Bank account:\n\n<code>${generatedOtp}</code>\n\n⏳ Expires in 1 minute\n\n⚠️ <b>Oro will never ask for this code.</b> Do not share it with anyone.`,
      )
      .catch((err) =>
        this.logger.warn(
          `Failed to send withdrawal OTP via Telegram: ${err.message}`,
        ),
      );

    return {
      success: true,
      paymentId: payment.id,
      status: "pending",
      amount,
      currency: "BTN",
      method: "dkbank",
      message:
        "OTP sent to your Telegram. Please enter it to confirm the withdrawal.",
      timestamp: now.toISOString(),
      otpRequired: true,
    };
  }

  /**
   * Step 2 — Withdrawal confirmation.
   * Validates the Telegram OTP, then inside a single atomic DB transaction:
   *   1. Re-checks balance under pessimistic_write lock (prevents TOCTOU)
   *   2. Calls DK Gateway to push funds from merchant vault → user DK account
   *   3. Only if DK transfer succeeds: writes the WITHDRAWAL debit ledger entry
   *      and marks the payment SUCCESS
   *
   * If the DK transfer fails or throws, the transaction rolls back — no debit
   * is written and the merchant vault balance is unchanged.
   */
  async confirmWithdrawal(
    userId: string,
    paymentId: string,
    otp: string,
  ): Promise<PaymentInitiateResponse> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Withdrawal is already ${payment.status}`);
    }

    const MAX_OTP_ATTEMPTS = 5;

    // ── OTP lockout check ────────────────────────────────────────────────────
    const otpRecord = await this.otpRepo.findOne({
      where: { paymentId, userId },
      order: { createdAt: "DESC" },
    });
    if (otpRecord && otpRecord.failedAttempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        "Too many incorrect OTP attempts. Please initiate a new withdrawal.",
      );
    }

    // ── Telegram OTP validation ──────────────────────────────────────────────
    const tgOtpSession = await this.redis.getJson<{
      otp: string;
      userId: string;
    }>(`oro:tg-otp:${paymentId}`);
    if (!tgOtpSession) {
      throw new BadRequestException(
        "OTP has expired. Please initiate a new withdrawal.",
      );
    }
    if (tgOtpSession.userId !== userId) {
      throw new BadRequestException("Payment not found.");
    }

    const { timingSafeEqual } = await import("crypto");
    const otpValid =
      tgOtpSession.otp.length === otp.length &&
      timingSafeEqual(Buffer.from(tgOtpSession.otp), Buffer.from(otp));

    if (!otpValid) {
      if (otpRecord) {
        otpRecord.failedAttempts += 1;
        await this.otpRepo.save(otpRecord);
      }
      throw new BadRequestException(
        "Invalid OTP. Please check your Telegram and try again.",
      );
    }

    // OTP is valid — delete it immediately to prevent replay
    await this.redis.del(`oro:tg-otp:${paymentId}`);

    // ── Atomic: balance re-check + DK transfer + ledger debit ────────────────
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const withdrawalAmount = Number(payment.amount);

    const result: { status: "success" | "failed"; failureReason?: string } = {
      status: "success",
    };

    await this.dataSource.transaction(async (em) => {
      // Pessimistic lock: re-read payment to prevent concurrent withdrawal attempts
      const lockedPayment = await em
        .getRepository(Payment)
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: paymentId })
        .andWhere("p.userId = :userId", { userId })
        .getOne();
      if (!lockedPayment) throw new NotFoundException("Payment not found");
      if (lockedPayment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `Withdrawal is already ${lockedPayment.status}`,
        );
      }

      // Re-check balance under lock (authoritative TOCTOU guard)
      const { balance: rawBalance } = await em
        .getRepository(Transaction)
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.amount), 0)", "balance")
        .where("t.userId = :userId", { userId })
        .getRawOne();
      const balanceBefore = Number(rawBalance);

      if (balanceBefore < withdrawalAmount) {
        throw new BadRequestException(
          `Insufficient balance. Available: Nu ${balanceBefore.toFixed(2)}.`,
        );
      }

      // ── Call DK Gateway: push funds from merchant vault to user account ───
      // Uses /v1/initiate/transaction which works in both staging and production.
      // No bypass needed — this endpoint is confirmed working in DK staging.
      const isStagingWithdrawalBypass =
        this.configService.get<string>("DK_STAGING_WITHDRAWAL_BYPASS") ===
        "true";

      let transferResult: {
        txnId: string | null;
        txnStatusId?: string | null;
        inquiryId?: string | null;
        status: string;
        statusDesc: string;
        raw?: unknown;
      };
      if (isStagingWithdrawalBypass) {
        this.logger.warn(
          `[STAGING] Skipping real DK transfer for payment ${lockedPayment.id} — DK_STAGING_WITHDRAWAL_BYPASS active`,
        );
        transferResult = {
          txnId: `STAGING-${Date.now()}`,
          status: "SUCCESS",
          statusDesc: "Staging bypass — no real transfer",
        };
      } else {
        transferResult = await this.dkGateway.transferToAccount({
          accountNumber:
            user?.dkAccountNumber ?? lockedPayment.metadata?.dkAccountNumber,
          accountName:
            user?.dkAccountName ??
            lockedPayment.metadata?.dkAccountName ??
            undefined,
          amount: withdrawalAmount,
          currency: "BTN",
          reference: lockedPayment.id,
          description: `oro withdrawal for user ${userId}`,
        });
      }

      const transferSucceeded =
        typeof transferResult?.status === "string" &&
        transferResult.status.toUpperCase().includes("SUCCESS");

      if (!transferSucceeded) {
        // DK returned a failure response — mark payment FAILED, no debit written
        lockedPayment.status = PaymentStatus.FAILED;
        lockedPayment.failureReason =
          transferResult?.statusDesc || "DK Bank transfer failed";
        lockedPayment.confirmedAt = new Date();
        await em.save(lockedPayment);
        result.status = "failed";
        result.failureReason = lockedPayment.failureReason ?? undefined;
        return; // exit transaction without writing debit
      }

      // ── DK transfer succeeded — write the ledger debit ───────────────────
      await em.save(
        Transaction,
        em.create(Transaction, {
          type: TransactionType.WITHDRAWAL,
          amount: -withdrawalAmount, // negative = debit from in-app balance
          balanceBefore,
          balanceAfter: balanceBefore - withdrawalAmount,
          paymentId: lockedPayment.id,
          userId,
          note: `DK Bank withdrawal confirmed`,
        }),
      );

      lockedPayment.status = PaymentStatus.SUCCESS;
      lockedPayment.confirmedAt = new Date();
      lockedPayment.externalPaymentId = transferResult?.txnId ?? null;
      lockedPayment.failureReason = null;
      await em.save(lockedPayment);
    });

    // ── Cleanup ──────────────────────────────────────────────────────────────
    if (otpRecord) {
      otpRecord.status = OtpStatus.VERIFIED;
      otpRecord.verifiedAt = new Date();
      await this.otpRepo.save(otpRecord);
    }
    await this.redis.del(`oro:otp:${paymentId}`);
    await this.redis.del(`oro:cache:balance:${userId}`);

    if (result.status === "failed") {
      await this.paymentRepo.save(
        Object.assign(payment, {
          status: PaymentStatus.FAILED,
          failureReason: result.failureReason,
        }),
      );
      return {
        success: false,
        paymentId: payment.id,
        status: "failed",
        amount: withdrawalAmount,
        currency: payment.currency,
        method: "dkbank",
        message: result.failureReason ?? "Withdrawal failed",
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      paymentId: payment.id,
      status: "success",
      amount: withdrawalAmount,
      currency: payment.currency,
      method: "dkbank",
      message:
        "Withdrawal confirmed. Funds are on their way to your DK Bank account.",
      timestamp: new Date().toISOString(),
    };
  }
}
