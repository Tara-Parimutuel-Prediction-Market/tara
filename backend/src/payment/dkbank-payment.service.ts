import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
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

/** OTP window: 10 minutes to match typical DK Bank OTP validity. */
const OTP_TTL_MS = 10 * 60 * 1000;

export interface DKBankPaymentRequest {
  amount: number;
  customerPhone: string; // CID number for DK lookup
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
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentOtp) private readonly otpRepo: Repository<PaymentOtp>,
  ) {}

  /**
   * Step 1: Look up customer account by CID and call DK account_auth.
   * DK sends an OTP to the customer's registered phone.
   * Returns paymentId + otpRequired: true.
   */
  async initiatePayment(userId: string, dto: DKBankPaymentRequest): Promise<PaymentInitiateResponse> {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Amount must be a positive number");
    }
    const cid =
      typeof dto.customerPhone === "string"
        ? dto.customerPhone.trim().replace(/\s+/g, "").replace(/[^\d]/g, "")
        : "";
    if (!cid) throw new BadRequestException("customerPhone (CID) is required");
    if (!dto.description || typeof dto.description !== "string") {
      throw new BadRequestException("description is required");
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

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

    // ── Staging bypass: skip all DK API calls and credit balance directly ────
    const bypassOtp = this.configService.get<string>("DK_STAGING_OTP_BYPASS");
    if (bypassOtp) {
      this.logger.warn(`[STAGING BYPASS] Skipping DK API calls for payment ${payment.id} — crediting ${amount} BTN directly`);
      await this.applyDKStatusUpdate({
        userId,
        paymentId: payment.id,
        dkRaw: { bypass: true },
        dkStatus: "SUCCESS",
        dkStatusDesc: "Staging bypass",
        isFromWebhook: false,
      });

      // Record OTP as immediately verified (staging has no real OTP)
      const now = new Date();
      await this.otpRepo.save(this.otpRepo.create({
        paymentId: payment.id,
        userId,
        marketId: dto.marketId || null,
        disputeId: dto.disputeId || null,
        status: OtpStatus.VERIFIED,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastRequestedAt: now,
        verifiedAt: now,
        requestCount: 1,
        failedAttempts: 0,
        bfsTxnId: null,
      }));

      return {
        success: true,
        paymentId: payment.id,
        status: "success" as any,
        amount,
        currency: "BTN",
        method: "dkbank",
        message: "Payment successful.",
        timestamp: now.toISOString(),
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      // 1) Resolve customer account from CID
      const account = await this.dkGateway.lookupAccountByCID(cid);

      // 2) Generate STAN (must be reused in confirm step)
      const stanNumber = this.dkGateway.generateStanNumber();

      // 3) Authorize transaction — DK sends OTP to customer's phone
      const auth = await this.dkGateway.authorizeTransaction({
        customerAccountNumber: account.accountNumber,
        customerAccountName: account.accountName,
        customerPhone: account.phoneNumber,
        amount,
        description: dto.description,
        stanNumber,
      });

      payment.dkInquiryId = auth.bfsTxnId;
      payment.customerPhone = account.phoneNumber || null;
      payment.metadata = {
        ...(payment.metadata || {}),
        bfsTxnId: auth.bfsTxnId,
        stanNumber: auth.stanNumber,
        txDatetime: auth.txDatetime,
        customerAccountNumber: account.accountNumber,
        customerAccountName: account.accountName,
        dkAuthResponse: auth,
      };
      await this.paymentRepo.save(payment);

      // 4) Create the OTP tracking record
      const now = new Date();
      await this.otpRepo.save(this.otpRepo.create({
        paymentId: payment.id,
        userId,
        marketId: dto.marketId || null,
        disputeId: dto.disputeId || null,
        status: OtpStatus.PENDING,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastRequestedAt: now,
        verifiedAt: null,
        requestCount: 1,
        failedAttempts: 0,
        bfsTxnId: auth.bfsTxnId,
      }));

      return {
        success: true,
        paymentId: payment.id,
        status: "pending",
        amount,
        currency: "BTN",
        method: "dkbank",
        message: "OTP sent to your registered DK Bank phone number. Please enter it to complete the payment.",
        timestamp: now.toISOString(),
        otpRequired: true,
      };
    } catch (e: any) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = e?.message || "Failed to initiate payment";
      payment.metadata = {
        ...(payment.metadata || {}),
        dkInitiateError: { message: payment.failureReason },
      };
      await this.paymentRepo.save(payment);
      throw e;
    }
  }

  /**
   * Step 2: Submit the OTP to complete the payment.
   * Executes the debit_request on DK and transitions the payment to pending (awaiting DK confirmation).
   */
  async confirmPayment(userId: string, paymentId: string, otp: string): Promise<PaymentInitiateResponse> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already ${payment.status}`);
    }

    const meta = payment.metadata || {};
    const bfsTxnId = meta.bfsTxnId;
    const stanNumber = meta.stanNumber;
    const txDatetime = meta.txDatetime;
    const sourceAccountNumber = meta.customerAccountNumber;
    const sourceAccountName = meta.customerAccountName;

    if (!bfsTxnId || !stanNumber || !txDatetime || !sourceAccountNumber) {
      throw new BadRequestException("Payment is missing authorization data — please initiate again");
    }

    this.logger.log(`[OTP] paymentId=${paymentId} otp=${otp}`);

    // Load the OTP tracking record for this payment
    const otpRecord = await this.otpRepo.findOne({
      where: { paymentId, userId },
      order: { createdAt: "DESC" },
    });

    // Guard: check OTP session hasn't expired
    if (otpRecord && otpRecord.status === OtpStatus.PENDING && otpRecord.expiresAt < new Date()) {
      otpRecord.status = OtpStatus.EXPIRED;
      await this.otpRepo.save(otpRecord);
      throw new BadRequestException("OTP has expired. Please initiate a new payment.");
    }

    // ── Staging bypass ────────────────────────────────────────────────────────
    const bypassOtp = this.configService.get<string>("DK_STAGING_OTP_BYPASS");
    if (bypassOtp && otp === bypassOtp) {
      this.logger.warn(`[STAGING BYPASS] OTP matched bypass code — crediting balance directly without DK debit_request`);
      await this.applyDKStatusUpdate({
        userId,
        paymentId: payment.id,
        dkRaw: { bypass: true },
        dkStatus: "SUCCESS",
        dkStatusDesc: "Staging bypass",
        isFromWebhook: false,
      });

      if (otpRecord) {
        const now = new Date();
        otpRecord.status = OtpStatus.VERIFIED;
        otpRecord.verifiedAt = now;
        await this.otpRepo.save(otpRecord);
      }

      return {
        success: true,
        paymentId: payment.id,
        status: "success" as any,
        amount: Number(payment.amount),
        currency: payment.currency,
        method: "dkbank",
        message: "[STAGING] Payment bypassed and balance credited.",
        timestamp: new Date().toISOString(),
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      const result = await this.dkGateway.executeTransactionWithOtp({
        bfsTxnId,
        otp,
        stanNumber,
        txDatetime,
        sourceAccountNumber,
        sourceAccountName,
        amount: Number(payment.amount),
        description: payment.description,
      });

      const now = new Date();
      payment.dkTxnStatusId = result.txnStatusId;
      payment.externalPaymentId = result.txnStatusId;
      payment.metadata = {
        ...(payment.metadata || {}),
        dkExecuteResponse: result.raw,
        otpConfirmedAt: now.toISOString(),
      };
      await this.paymentRepo.save(payment);

      // Mark OTP as verified
      if (otpRecord) {
        otpRecord.status = OtpStatus.VERIFIED;
        otpRecord.verifiedAt = now;
        await this.otpRepo.save(otpRecord);
      }

      return {
        success: true,
        paymentId: payment.id,
        status: "pending",
        amount: Number(payment.amount),
        currency: payment.currency,
        method: "dkbank",
        message: "Payment submitted. Waiting for DK Bank confirmation.",
        timestamp: now.toISOString(),
        paymentUrl: result.paymentUrl,
        qrCode: result.qrCode,
      };
    } catch (e: any) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = e?.message || "OTP confirmation failed";
      payment.metadata = {
        ...(payment.metadata || {}),
        dkConfirmError: { message: payment.failureReason, otpAttemptedAt: new Date().toISOString() },
      };
      await this.paymentRepo.save(payment);

      // Increment failed attempts on the OTP record
      if (otpRecord && otpRecord.status === OtpStatus.PENDING) {
        otpRecord.failedAttempts += 1;
        await this.otpRepo.save(otpRecord);
      }

      throw e;
    }
  }

  async getPaymentStatus(userId: string, paymentId: string): Promise<PaymentStatusResponse> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException("Payment not found");

    if (payment.status === PaymentStatus.SUCCESS) return this.mapPayment(payment);
    if (payment.status === PaymentStatus.FAILED)  return this.mapPayment(payment);

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

    const txnStatusId = payment.dkTxnStatusId || payment.externalPaymentId || "";
    let dkResult: Awaited<ReturnType<DKGatewayService["checkTransactionStatus"]>> | null = null;
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

    const updated = await this.paymentRepo.findOne({ where: { id: payment.id, userId } });
    if (!updated) throw new NotFoundException("Payment not found after update");
    return this.mapPayment(updated);
  }

  async handleWebhook(payload: any, signatureHeader?: string) {
    const sigOk = this.dkGateway.verifyWebhookSignature(payload, signatureHeader);
    if (!sigOk) throw new BadRequestException("Invalid DK webhook signature");

    const inquiryId = payload?.inquiry_id || payload?.bfs_txn_id;
    if (!inquiryId || typeof inquiryId !== "string") {
      throw new BadRequestException("Missing inquiry_id/bfs_txn_id in DK webhook payload");
    }

    const payment = await this.paymentRepo.findOne({
      where: { dkInquiryId: inquiryId },
      relations: ["user"],
    });
    if (!payment) return { received: true, ignored: true };

    const txnStatusId = payment.dkTxnStatusId || payment.externalPaymentId;
    if (!txnStatusId) {
      payment.metadata = { ...(payment.metadata || {}), dkWebhookPayload: payload };
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
        dkWebhookStatusError: { message: e?.message || "DK webhook status error" },
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
      payment.status === PaymentStatus.SUCCESS ? "success"
      : payment.status === PaymentStatus.FAILED  ? "failed"
      : payment.metadata?.bfsTxnId && !payment.dkTxnStatusId ? "otp_required"
      : "pending";
    return {
      paymentId: payment.id,
      status,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method,
      confirmedAt: payment.confirmedAt ? payment.confirmedAt.toISOString() : undefined,
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
    const mapped =
      statusUpper.includes("SUCCESS") ? PaymentStatus.SUCCESS
      : statusUpper.includes("FAIL")  ? PaymentStatus.FAILED
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
      if (params.dkWebhookPayload) payment.metadata.dkWebhookPayload = params.dkWebhookPayload;

      if (mapped === PaymentStatus.SUCCESS) {
        payment.status = PaymentStatus.SUCCESS;
        payment.confirmedAt = new Date();
        payment.failureReason = null;

        // Snapshot balance before crediting
        const { balance: rawBefore } = await em.getRepository(Transaction)
          .createQueryBuilder("t")
          .select("COALESCE(SUM(t.amount), 0)", "balance")
          .where("t.userId = :userId", { userId: params.userId })
          .getRawOne();
        const balanceBefore = Number(rawBefore);

        this.logger.log(`[CREDITS] Crediting ${payment.amount} to user ${params.userId} from DK payment ${payment.id}`);

        await em.save(Transaction, em.create(Transaction, {
          type: TransactionType.DEPOSIT,
          amount: Number(payment.amount),
          balanceBefore,
          balanceAfter: balanceBefore + Number(payment.amount),
          paymentId: payment.id,
          userId: params.userId,
          note: `DK Bank deposit confirmed (dk_payment: ${payment.id})`,
        }));
      } else if (mapped === PaymentStatus.FAILED) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = params.dkStatusDesc || "Payment failed";
        payment.confirmedAt = new Date();
      }

      await em.save(payment);
    });
  }
}
