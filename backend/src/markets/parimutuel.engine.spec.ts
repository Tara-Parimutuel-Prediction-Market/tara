import { BadRequestException } from "@nestjs/common";
import { ParimutuelEngine } from "./parimutuel.engine";
import { MarketStatus } from "../entities/market.entity";
import { BetStatus } from "../entities/bet.entity";
import { TransactionType } from "../entities/transaction.entity";
import { LMSRService } from "./lmsr.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOutcome(overrides: any = {}) {
  return {
    id: "outcome-1",
    label: "Team A",
    totalBetAmount: 0,
    currentOdds: 0,
    lmsrProbability: 0.5,
    isWinner: false,
    ...overrides,
  };
}

function makeMarket(overrides: any = {}) {
  return {
    id: "market-1",
    title: "Test Market",
    status: MarketStatus.OPEN,
    totalPool: 0,
    houseEdgePct: 5,
    liquidityParam: 1000,
    outcomes: [
      makeOutcome({ id: "o1", label: "A" }),
      makeOutcome({ id: "o2", label: "B" }),
    ],
    resolvedOutcomeId: null,
    resolvedAt: null,
    ...overrides,
  };
}

// ─── calcOdds ─────────────────────────────────────────────────────────────────

describe("ParimutuelEngine.calcOdds", () => {
  let engine: ParimutuelEngine;

  beforeEach(() => {
    // calcOdds is a pure method — no dependencies needed
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

// ─── placeBet ─────────────────────────────────────────────────────────────────

describe("ParimutuelEngine.placeBet", () => {
  let engine: ParimutuelEngine;
  let mockMarketRepo: any;
  let mockBetRepo: any;
  let mockDataSource: any;
  let mockRedis: any;
  let mockLmsr: any;
  let mockEm: any;

  beforeEach(() => {
    const market = makeMarket();

    mockEm = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(market),
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: 500 }),
        }),
      }),
      findOne: jest.fn().mockResolvedValue({ id: "user-1" }),
      save: jest
        .fn()
        .mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
      find: jest.fn().mockResolvedValue([
        makeOutcome({ id: "o1", label: "A" }),
        makeOutcome({ id: "o2", label: "B" }),
      ]),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation((cb: Function) => cb(mockEm)),
    };

    mockRedis = {
      acquireLockWithRetry: jest.fn().mockResolvedValue("lock-token"),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    mockLmsr = {
      calculateProbabilities: jest.fn().mockReturnValue([0.5, 0.5]),
    };

    engine = new ParimutuelEngine(
      mockMarketRepo,
      null as any,
      mockBetRepo,
      null as any,
      null as any,
      null as any,
      null as any,
      mockDataSource,
      mockLmsr,
      mockRedis,
      null as any,
    );
  });

  it("throws when amount <= 0", async () => {
    await expect(
      engine.placeBet("user-1", "market-1", "o1", 0),
    ).rejects.toThrow(BadRequestException);
    await expect(
      engine.placeBet("user-1", "market-1", "o1", -5),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when market is not open", async () => {
    mockEm.getRepository.mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue(makeMarket({ status: MarketStatus.CLOSED })),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ balance: 500 }),
      }),
    });

    await expect(
      engine.placeBet("user-1", "market-1", "o1", 100),
    ).rejects.toThrow("Market is not open for betting");
  });

  it("throws when balance is insufficient", async () => {
    // balance = 50, bet = 200
    const balanceQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ balance: 50 }),
    };
    const marketQb = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(makeMarket()),
    };

    mockEm.find = jest.fn().mockResolvedValue([
      makeOutcome({ id: "o1", label: "A" }),
      makeOutcome({ id: "o2", label: "B" }),
    ]);
    mockEm.getRepository.mockImplementation((entity: any) => {
      if (
        entity?.name === "Transaction" ||
        (entity && entity.toString().includes("Transaction"))
      ) {
        return { createQueryBuilder: jest.fn().mockReturnValue(balanceQb) };
      }
      return { createQueryBuilder: jest.fn().mockReturnValue(marketQb) };
    });

    await expect(
      engine.placeBet("user-1", "market-1", "o1", 200),
    ).rejects.toThrow("Insufficient balance");
  });

  it("throws when outcome not found in market", async () => {
    await expect(
      engine.placeBet("user-1", "market-1", "nonexistent-outcome", 100),
    ).rejects.toThrow("Outcome not found in this market");
  });

  it("successfully creates a bet and debit transaction", async () => {
    const savedBet = { id: "bet-1", status: BetStatus.PENDING, amount: 100 };
    mockEm.save.mockImplementation((_entity: any, data: any) => {
      if (data?.status === BetStatus.PENDING) return Promise.resolve(savedBet);
      return Promise.resolve(data);
    });

    const result = await engine.placeBet("user-1", "market-1", "o1", 100);
    expect(result).toMatchObject({ id: "bet-1", status: BetStatus.PENDING });
    expect(mockRedis.releaseLock).toHaveBeenCalledWith(
      "market:market-1",
      "lock-token",
    );
    expect(mockRedis.del).toHaveBeenCalled();
  });
});

// transitionMarket

describe("ParimutuelEngine.transitionMarket", () => {
  let engine: ParimutuelEngine;
  let mockMarketRepo: any;

  function makeRepo(market: any) {
    return {
      findOneBy: jest.fn().mockResolvedValue(market),
      save: jest.fn().mockImplementation((m: any) => Promise.resolve(m)),
      findOne: jest.fn().mockResolvedValue(market),
    };
  }

  it("transitions OPEN → CLOSED", async () => {
    const market = makeMarket({ status: MarketStatus.OPEN });
    mockMarketRepo = makeRepo(market);
    engine = new ParimutuelEngine(
      mockMarketRepo,
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
    );

    const result = await engine.transitionMarket(
      "market-1",
      MarketStatus.CLOSED,
    );
    expect(result.status).toBe(MarketStatus.CLOSED);
  });

  it("throws on invalid transition OPEN → RESOLVED", async () => {
    const market = makeMarket({ status: MarketStatus.OPEN });
    mockMarketRepo = makeRepo(market);
    engine = new ParimutuelEngine(
      mockMarketRepo,
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
    );

    await expect(
      engine.transitionMarket("market-1", MarketStatus.RESOLVED),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when market not found", async () => {
    mockMarketRepo = { findOneBy: jest.fn().mockResolvedValue(null) };
    engine = new ParimutuelEngine(
      mockMarketRepo,
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
    );

    await expect(
      engine.transitionMarket("bad-id", MarketStatus.CLOSED),
    ).rejects.toThrow("Market not found");
  });
});

// ─── cancelMarket ─────────────────────────────────────────────────────────────

describe("ParimutuelEngine.cancelMarket", () => {
  it("refunds all PENDING bets", async () => {
    const market = makeMarket({ status: MarketStatus.OPEN });
    const pendingBet = {
      id: "b1",
      userId: "u1",
      amount: 100,
      status: BetStatus.PENDING,
    };

    const savedItems: any[] = [];
    const mockEm: any = {
      findOne: jest.fn().mockResolvedValue(market),
      find: jest.fn().mockResolvedValue([pendingBet]),
      save: jest.fn().mockImplementation((_e: any, data: any) => {
        savedItems.push(data);
        return Promise.resolve(data);
      }),
      create: jest.fn().mockImplementation((_e: any, data: any) => data),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: 0 }),
        }),
      }),
    };

    const engine = new ParimutuelEngine(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      { transaction: (cb: Function) => cb(mockEm) } as any,
      null as any,
      null as any,
      null as any,
    );

    await engine.cancelMarket("market-1");

    const refundTx = savedItems.find((i) => i.type === TransactionType.REFUND);
    expect(refundTx).toBeDefined();
    expect(refundTx.amount).toBe(100);

    const updatedBet = savedItems.find((i) => i.id === "b1");
    expect(updatedBet?.status).toBe(BetStatus.REFUNDED);
  });
});

// LMSRService

describe("LMSRService.calculateProbabilities", () => {
  const svc = new LMSRService();

  it("returns empty array for no outcomes", () => {
    expect(svc.calculateProbabilities([])).toEqual([]);
  });

  it("returns equal probabilities when all bets are 0", () => {
    const outcomes = [makeOutcome({ id: "o1" }), makeOutcome({ id: "o2" })];
    const probs = svc.calculateProbabilities(outcomes as any, 1000);
    expect(probs[0]).toBeCloseTo(0.5);
    expect(probs[1]).toBeCloseTo(0.5);
  });

  it("favours the outcome with more bets", () => {
    const outcomes = [
      makeOutcome({ id: "o1", totalBetAmount: 900 }),
      makeOutcome({ id: "o2", totalBetAmount: 100 }),
    ];
    const probs = svc.calculateProbabilities(outcomes as any, 1000);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it("probabilities always sum to ~1", () => {
    const outcomes = [
      makeOutcome({ id: "o1", totalBetAmount: 300 }),
      makeOutcome({ id: "o2", totalBetAmount: 500 }),
      makeOutcome({ id: "o3", totalBetAmount: 200 }),
    ];
    const probs = svc.calculateProbabilities(outcomes as any, 1000);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
