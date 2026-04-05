import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DKBankPaymentService } from "./dkbank-payment.service";
import { PaymentStatus, PaymentMethod, PaymentType } from "../entities/payment.entity";
import { OtpStatus } from "../entities/payment-otp.entity";
import { TransactionType } from "../entities/transaction.entity";

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeUser(overrides: any = {}) {
  return {
    id: "user-1",
    telegramId: "99999",
    firstName: "Test",
    dkCid: "11000000001",
    ...overrides,
  };
}

function makePayment(overrides: any = {}) {
  return {
    id: "payment-1",
    userId: "user-1",
    status: PaymentStatus.PENDING,
    amount: 100,
    currency: "BTN",
    method: PaymentMethod.DK_BANK,
    type: PaymentType.DEPOSIT,
    metadata: {},
    ...overrides,
  };
}

function makeOtpRecord(overrides: any = {}) {
  return {
    id: "otp-1",
    paymentId: "payment-1",
    userId: "user-1",
    status: OtpStatus.PENDING,
    failedAttempts: 0,
    ...overrides,
  };
}

function makeUserRepo(user: any = makeUser()) {
  return {
    findOne: jest.fn().mockResolvedValue(user),
    create: jest.fn().mockImplementation((d: any) => d),
    save: jest.fn().mockImplementation((d: any) => Promise.resolve(d)),
  };
}

function makePaymentRepo(payment: any = makePayment()) {
  return {
    findOne: jest.fn().mockResolvedValue(payment),
    create: jest.fn().mockImplementation((d: any) => d),
    save: jest.fn().mockImplementation((d: any) => Promise.resolve(d)),
    find: jest.fn().mockResolvedValue([]),
  };
}

function makeOtpRepo(record: any = makeOtpRecord()) {
  return {
    findOne: jest.fn().mockResolvedValue(record),
    create: jest.fn().mockImplementation((d: any) => d),
    save: jest.fn().mockImplementation((d: any) => Promise.resolve(d)),
  };
}

function makeRedis(otpSession: any = { otp: "123456", userId: "user-1" }) {
  return {
    getJson: jest.fn().mockResolvedValue(otpSession),
    setJsonEx: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    rateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  };
}

function makeDkGateway(account: any = { accountNumber: "ACC001", accountName: "Test", phoneNumber: "17000001" }) {
  return {
    lookupAccountByCID: jest.fn().mockResolvedValue(account),
    checkTransactionStatus: jest.fn(),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    clientInquiry: jest.fn(),
  };
}

function makeDataSource(overrides: any = {}) {
  const em = {
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makePayment()),
        getRawOne: jest.fn().mockResolvedValue({ balance: 500 }),
      }),
    }),
    save: jest.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
    create: jest.fn().mockImplementation((_e: any, d: any) => d),
    ...overrides,
  };
  return {
    transaction: jest.fn().mockImplementation((cb: Function) => cb(em)),
    _em: em,
  };
}

function makeTelegramService() {
  return { sendMessage: jest.fn().mockResolvedValue(undefined) };
}

function makeTelegramVerification() {
  return { verifyPaymentIdentity: jest.fn().mockResolvedValue(undefined) };
}

function makeConfigService() {
  return { get: jest.fn().mockReturnValue("http://dk.example.com") };
}

function makeService(overrides: {
  user?: any;
  payment?: any;
  otp?: any;
  redis?: any;
  dkGateway?: any;
  dataSource?: any;
  telegramVerification?: any;
} = {}) {
  const userRepo = makeUserRepo("user" in overrides ? overrides.user : makeUser());
  const paymentRepo = makePaymentRepo("payment" in overrides ? overrides.payment : makePayment());
  const otpRepo = makeOtpRepo("otp" in overrides ? overrides.otp : makeOtpRecord());
  const redis = overrides.redis ?? makeRedis();
  const dkGateway = overrides.dkGateway ?? makeDkGateway();
  const dataSource = overrides.dataSource ?? makeDataSource();
  const telegramVerification = overrides.telegramVerification ?? makeTelegramVerification();

  const service = new DKBankPaymentService(
    dataSource as any,
    dkGateway as any,
    makeConfigService() as any,
    redis as any,
    makeTelegramService() as any,
    telegramVerification as any,
    userRepo as any,
    paymentRepo as any,
    otpRepo as any,
  );

  return { service, userRepo, paymentRepo, otpRepo, redis, dkGateway, dataSource };
}

// ─── initiatePayment ──────────────────────────────────────────────────────────

describe("DKBankPaymentService.initiatePayment", () => {
  it("throws on non-positive amount", async () => {
    const { service } = makeService();
    await expect(
      service.initiatePayment("user-1", {
        amount: 0,
        customerPhone: "11000000001",
        description: "test",
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.initiatePayment("user-1", {
        amount: -50,
        customerPhone: "11000000001",
        description: "test",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when user has no linked DK account", async () => {
    const { service } = makeService({ user: makeUser({ dkCid: null }) });
    await expect(
      service.initiatePayment("user-1", {
        amount: 100,
        customerPhone: "11000000001",
        description: "top-up",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when submitted CID does not match linked CID", async () => {
    const { service } = makeService({ user: makeUser({ dkCid: "11000000001" }) });
    await expect(
      service.initiatePayment("user-1", {
        amount: 100,
        customerPhone: "99900000000", // wrong CID
        description: "top-up",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when phone identity verification fails", async () => {
    const telegramVerification = {
      verifyPaymentIdentity: jest.fn().mockRejectedValue(
        new BadRequestException("Phone not verified"),
      ),
    };
    const { service } = makeService({ telegramVerification });
    await expect(
      service.initiatePayment("user-1", {
        amount: 100,
        customerPhone: "11000000001",
        description: "top-up",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when user is not found", async () => {
    const { service } = makeService({ user: null });
    await expect(
      service.initiatePayment("user-1", {
        amount: 100,
        customerPhone: "11000000001",
        description: "top-up",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("returns otpRequired: true on success and sends Telegram OTP", async () => {
    const { service, redis } = makeService();
    const result = await service.initiatePayment("user-1", {
      amount: 200,
      customerPhone: "11000000001",
      description: "test deposit",
    });

    expect(result.otpRequired).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.amount).toBe(200);
    // OTP stored in Redis
    expect(redis.setJsonEx).toHaveBeenCalled();
  });
});

// ─── confirmPayment ───────────────────────────────────────────────────────────

describe("DKBankPaymentService.confirmPayment", () => {
  it("throws when payment is not found", async () => {
    const { service } = makeService({ payment: null });
    await expect(
      service.confirmPayment("user-1", "payment-1", "123456"),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws when payment is already confirmed", async () => {
    const { service } = makeService({
      payment: makePayment({ status: PaymentStatus.SUCCESS }),
    });
    await expect(
      service.confirmPayment("user-1", "payment-1", "123456"),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when OTP has expired (not in Redis)", async () => {
    const redis = makeRedis(null); // null = expired / missing
    const { service } = makeService({ redis });
    await expect(
      service.confirmPayment("user-1", "payment-1", "123456"),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws and increments failedAttempts on wrong OTP", async () => {
    const otpRecord = makeOtpRecord({ failedAttempts: 0 });
    const otpRepo = makeOtpRepo(otpRecord);
    const redis = makeRedis({ otp: "654321", userId: "user-1" }); // correct OTP is 654321

    const { service } = makeService({ otp: otpRecord, redis });
    // Re-bind otpRepo so we can inspect saves
    (service as any).otpRepo = otpRepo;

    await expect(
      service.confirmPayment("user-1", "payment-1", "000000"), // wrong OTP
    ).rejects.toThrow(BadRequestException);

    expect(otpRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ failedAttempts: 1 }),
    );
  });

  it("throws immediately when max OTP attempts is already reached", async () => {
    const otpRecord = makeOtpRecord({ failedAttempts: 5 });
    const { service } = makeService({ otp: otpRecord });
    await expect(
      service.confirmPayment("user-1", "payment-1", "123456"),
    ).rejects.toThrow(BadRequestException);
  });

  it("credits balance and marks payment SUCCESS on correct OTP", async () => {
    const payment = makePayment({ status: PaymentStatus.PENDING });
    const paymentRepo = makePaymentRepo(payment);
    const redis = makeRedis({ otp: "123456", userId: "user-1" });

    // applyDKStatusUpdate runs inside a transaction — mock it to track calls
    const dataSource = makeDataSource();
    const em = dataSource._em;

    // Payment repo in transaction should return PENDING payment (for pessimistic lock query)
    em.getRepository.mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(payment),
        getRawOne: jest.fn().mockResolvedValue({ balance: 0 }),
      }),
    });

    const { service } = makeService({ payment, redis, dataSource });
    // Bind the payment repo so findOne works for the outer lookup
    (service as any).paymentRepo = paymentRepo;

    const result = await service.confirmPayment("user-1", "payment-1", "123456");

    expect(result.status).toBe("success");
    expect(result.paymentId).toBe("payment-1");
    // Transaction saved a credit entry
    expect(em.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ type: TransactionType.DEPOSIT }),
    );
    // Redis OTP key was deleted after use
    expect(redis.del).toHaveBeenCalledWith("tara:tg-otp:payment-1");
  });
});

// ─── getPaymentStatus ─────────────────────────────────────────────────────────

describe("DKBankPaymentService.getPaymentStatus", () => {
  it("throws when payment not found", async () => {
    const { service } = makeService({ payment: null });
    await expect(
      service.getPaymentStatus("user-1", "payment-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("returns success status for a confirmed payment", async () => {
    const payment = makePayment({
      status: PaymentStatus.SUCCESS,
      confirmedAt: new Date("2024-01-01"),
    });
    const { service } = makeService({ payment });
    const result = await service.getPaymentStatus("user-1", "payment-1");
    expect(result.status).toBe("success");
    expect(result.confirmedAt).toBeDefined();
  });

  it("returns failed status with failure reason", async () => {
    const payment = makePayment({
      status: PaymentStatus.FAILED,
      failureReason: "DK Bank rejected",
    });
    const { service } = makeService({ payment });
    const result = await service.getPaymentStatus("user-1", "payment-1");
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("DK Bank rejected");
  });

  it("returns pending status when no DK txn ID yet", async () => {
    const payment = makePayment({
      status: PaymentStatus.PENDING,
      dkTxnStatusId: null,
      externalPaymentId: null,
    });
    const { service } = makeService({ payment });
    const result = await service.getPaymentStatus("user-1", "payment-1");
    expect(result.status).toBe("pending");
  });
});

// ─── handleWebhook ────────────────────────────────────────────────────────────

describe("DKBankPaymentService.handleWebhook", () => {
  it("throws on invalid webhook signature", async () => {
    const dkGateway = makeDkGateway();
    dkGateway.verifyWebhookSignature = jest.fn().mockReturnValue(false);
    const { service } = makeService({ dkGateway });

    await expect(
      service.handleWebhook({ inquiry_id: "abc" }, "bad-sig"),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns ignored: true when payment is not found by inquiry ID", async () => {
    const paymentRepo = makePaymentRepo(null); // not found
    const { service } = makeService();
    (service as any).paymentRepo = paymentRepo;

    const result = await service.handleWebhook(
      { inquiry_id: "unknown-id" },
      "valid-sig",
    );
    expect(result).toMatchObject({ received: true, ignored: true });
  });

  it("throws when inquiry_id is missing from payload", async () => {
    const { service } = makeService();
    await expect(service.handleWebhook({}, "sig")).rejects.toThrow(
      BadRequestException,
    );
  });
});
