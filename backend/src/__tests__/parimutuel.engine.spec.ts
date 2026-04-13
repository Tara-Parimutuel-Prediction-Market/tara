import { BadRequestException } from "@nestjs/common";
import { ParimutuelEngine } from "../markets/parimutuel.engine";
import { TransactionType } from "../entities/transaction.entity";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const bypassConfigService = {
  get: jest.fn((key: string) => {
    if (
      key === "DK_STAGING_PAYOUT_BYPASS" ||
      key === "DK_STAGING_DEPOSIT_BYPASS" ||
      key === "DK_STAGING_WITHDRAWAL_BYPASS"
    )
      return "true";
    return undefined;
  }),
} as any;

// ─── calcOdds ─────────────────────────────────────────────────────────────────

describe("ParimutuelEngine.calcOdds", () => {
  let engine: ParimutuelEngine;

  beforeEach(() => {
    engine = new ParimutuelEngine(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      bypassConfigService,
      null as any,
      null as any, // challengesService
    );
  });

  it("returns 0 when outcomePool is 0", () => {
    expect(engine.calcOdds(1000, 5, 0)).toBe(0);
  });

  it("calculates correct odds with 5% house edge", () => {
    // payoutPool = 1000 * 0.95 = 950; outcomePool = 500 → odds = 1.9
    expect(engine.calcOdds(1000, 5, 500)).toBeCloseTo(1.9);
  });

  it("calculates odds when one outcome takes entire pool (5% edge)", () => {
    // payoutPool = 1000 * 0.95 = 950; winner holds all 1000 → 0.95
    expect(engine.calcOdds(1000, 5, 1000)).toBeCloseTo(0.95);
  });

  it("handles 0% house edge", () => {
    expect(engine.calcOdds(500, 0, 250)).toBeCloseTo(2.0);
  });

  it("handles 100% house edge (no payout)", () => {
    expect(engine.calcOdds(1000, 100, 500)).toBeCloseTo(0);
  });
});

// ─── Bonus cap logic (unit) ───────────────────────────────────────────────────

describe("Bonus credit cap logic", () => {
  const BONUS_CAP = 50;

  function calcBonusSplit(rawPayout: number, isBonusFunded: boolean) {
    if (!isBonusFunded) return { withdrawable: rawPayout, play: 0 };
    const withdrawable = Math.min(rawPayout, BONUS_CAP);
    const play = parseFloat((rawPayout - withdrawable).toFixed(2));
    return { withdrawable, play };
  }

  it("does not split payout when bet is NOT funded by bonus credits", () => {
    const { withdrawable, play } = calcBonusSplit(200, false);
    expect(withdrawable).toBe(200);
    expect(play).toBe(0);
  });

  it("caps withdrawable at Nu 50 when payout exceeds cap (bonus bet)", () => {
    const { withdrawable, play } = calcBonusSplit(120, true);
    expect(withdrawable).toBe(50);
    expect(play).toBe(70);
  });

  it("allows full payout when bonus bet wins less than Nu 50", () => {
    const { withdrawable, play } = calcBonusSplit(30, true);
    expect(withdrawable).toBe(30);
    expect(play).toBe(0);
  });

  it("caps exactly at Nu 50 when payout equals cap", () => {
    const { withdrawable, play } = calcBonusSplit(50, true);
    expect(withdrawable).toBe(50);
    expect(play).toBe(0);
  });

  it("play credits are marked isBonus=true, withdrawable is isBonus=false", () => {
    const rawPayout = 150;
    const { withdrawable, play } = calcBonusSplit(rawPayout, true);

    const withdrawableTx = {
      type: TransactionType.POSITION_PAYOUT,
      amount: withdrawable,
      isBonus: false,
    };
    const playTx = {
      type: TransactionType.FREE_CREDIT,
      amount: play,
      isBonus: true,
    };

    expect(withdrawableTx.isBonus).toBe(false);
    expect(playTx.isBonus).toBe(true);
    expect(withdrawableTx.amount + playTx.amount).toBe(rawPayout);
  });
});

// ─── placePosition: pre-flight guards ────────────────────────────────────────

describe("ParimutuelEngine.placePosition — pre-flight guards", () => {
  it("throws BadRequestException when amount <= 0", async () => {
    const engine = new ParimutuelEngine(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      bypassConfigService,
      null as any,
      null as any, // challengesService
    );
    await expect(engine.placePosition("u1", "m1", "o1", 0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(engine.placePosition("u1", "m1", "o1", -5)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws when user has no linked DK Bank account", async () => {
    // Market exists and is OPEN, but user has no dkAccountNumber
    const market = {
      id: "m1",
      status: "open",
      outcomes: [
        { id: "o1", totalBetAmount: 0, currentOdds: 0, lmsrProbability: 0.5 },
      ],
      totalPool: 0,
      houseEdgePct: 8,
      liquidityParam: 1000,
    };
    const user = {
      id: "u1",
      telegramId: "111",
      dkAccountNumber: null,
      phoneNumber: "17000001",
    };

    const mockEm = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(market),
        }),
      }),
      find: jest.fn().mockResolvedValue(market.outcomes),
      findOne: jest.fn().mockResolvedValue(user),
    };
    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb: Function) => cb(mockEm)),
    };
    const mockRedis = {
      acquireLockWithRetry: jest.fn().mockResolvedValue("lock-token"),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const engine = new ParimutuelEngine(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      mockDataSource as any,
      null as any,
      mockRedis as any,
      null as any,
      null as any,
      null as any,
      bypassConfigService,
      null as any,
      null as any,
    );

    await expect(engine.placePosition("u1", "m1", "o1", 100)).rejects.toThrow(
      "link your DK Bank account",
    );
  });

  it("throws when user has no verified phone number", async () => {
    // User has DK account but no phone number
    const market = {
      id: "m1",
      status: "open",
      outcomes: [
        { id: "o1", totalBetAmount: 0, currentOdds: 0, lmsrProbability: 0.5 },
      ],
      totalPool: 0,
      houseEdgePct: 8,
      liquidityParam: 1000,
    };
    const user = {
      id: "u1",
      telegramId: "111",
      dkAccountNumber: "ACC001",
      phoneNumber: null,
    };

    const mockEm = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(market),
        }),
      }),
      find: jest.fn().mockResolvedValue(market.outcomes),
      findOne: jest.fn().mockResolvedValue(user),
    };
    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb: Function) => cb(mockEm)),
    };
    const mockRedis = {
      acquireLockWithRetry: jest.fn().mockResolvedValue("lock-token"),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const engine = new ParimutuelEngine(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      mockDataSource as any,
      null as any,
      mockRedis as any,
      null as any,
      null as any,
      null as any,
      bypassConfigService,
      null as any,
      null as any,
    );

    await expect(engine.placePosition("u1", "m1", "o1", 100)).rejects.toThrow(
      "verified phone number",
    );
  });
});
