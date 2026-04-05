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

// ─── resolveMarket / settleMarket (payout path) ───────────────────────────────

describe("ParimutuelEngine.resolveMarket → settleMarket", () => {
  function makeResolvableEngine(bets: any[], winner: any, market: any) {
    const savedItems: any[] = [];

    const mockEm: any = {
      find: jest.fn().mockImplementation((entity: any) => {
        // Return bets when asked for Bet entity
        if (entity?.name === "Bet" || String(entity).includes("Bet")) {
          return Promise.resolve(bets);
        }
        return Promise.resolve([]);
      }),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((_entity: any, data: any) => {
        savedItems.push(data);
        return Promise.resolve(data);
      }),
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ balance: 0 }),
        }),
      }),
    };

    const mockMarketRepo = {
      findOne: jest.fn().mockResolvedValue({ ...market, outcomes: [winner, ...market.outcomes.filter((o: any) => o.id !== winner.id)] }),
      findOneBy: jest.fn().mockResolvedValue(market),
      save: jest.fn().mockImplementation((m: any) => Promise.resolve(m)),
    };

    const mockOutcomeRepo = {
      save: jest.fn().mockImplementation((o: any) => Promise.resolve(o)),
    };

    const mockDisputeRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockReputationService = {
      recalculateForMarket: jest.fn().mockResolvedValue(undefined),
    };

    const engine = new ParimutuelEngine(
      mockMarketRepo as any,
      mockOutcomeRepo as any,
      null as any,
      null as any,
      null as any,
      null as any,
      mockDisputeRepo as any,
      { transaction: (cb: Function) => cb(mockEm) } as any,
      null as any,
      null as any,
      mockReputationService as any,
    );

    return { engine, savedItems, mockEm, mockMarketRepo, mockOutcomeRepo };
  }

  it("marks winning bets as WON and losing bets as LOST", async () => {
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 300,
      houseEdgePct: 0,
      outcomes: [
        makeOutcome({ id: "winner", totalBetAmount: 200 }),
        makeOutcome({ id: "loser", totalBetAmount: 100 }),
      ],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 200, status: BetStatus.PENDING },
      { id: "b2", userId: "u2", outcomeId: "loser", amount: 100, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    const wonBet = savedItems.find((i) => i.id === "b1");
    const lostBet = savedItems.find((i) => i.id === "b2");

    expect(wonBet?.status).toBe(BetStatus.WON);
    expect(lostBet?.status).toBe(BetStatus.LOST);
  });

  it("pays out the full payout pool (0% house edge) to single winner", async () => {
    // totalPool = 1000, houseEdge = 0% → payoutPool = 1000
    // Single winning bet of 1000 (100% share) → payout = 1000
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 1000,
      houseEdgePct: 0,
      outcomes: [
        makeOutcome({ id: "winner", totalBetAmount: 1000 }),
      ],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 1000, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    const wonBet = savedItems.find((i) => i.id === "b1");
    expect(wonBet?.payout).toBeCloseTo(1000);
  });

  it("deducts house edge from payout pool", async () => {
    // totalPool = 1000, houseEdge = 10% → payoutPool = 900
    // Winner holds 100% → payout = 900
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 1000,
      houseEdgePct: 10,
      outcomes: [
        makeOutcome({ id: "winner", totalBetAmount: 500 }),
        makeOutcome({ id: "loser", totalBetAmount: 500 }),
      ],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 500, status: BetStatus.PENDING },
      { id: "b2", userId: "u2", outcomeId: "loser", amount: 500, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    // payoutPool = 1000 * 0.9 = 900; winner holds 500/500 = 100% → payout = 900
    const wonBet = savedItems.find((i) => i.id === "b1");
    expect(wonBet?.payout).toBeCloseTo(900);
  });

  it("splits payout pool proportionally among multiple winners", async () => {
    // totalPool = 300, houseEdge = 0% → payoutPool = 300
    // Two winning bets: u1=200, u2=100 → shares: 2/3, 1/3
    // Payouts: u1 = 200, u2 = 100
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 300,
      houseEdgePct: 0,
      outcomes: [
        makeOutcome({ id: "winner", totalBetAmount: 300 }),
      ],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 200, status: BetStatus.PENDING },
      { id: "b2", userId: "u2", outcomeId: "winner", amount: 100, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    const bet1 = savedItems.find((i) => i.id === "b1");
    const bet2 = savedItems.find((i) => i.id === "b2");

    expect(bet1?.payout).toBeCloseTo(200); // 2/3 of 300
    expect(bet2?.payout).toBeCloseTo(100); // 1/3 of 300
    expect(bet1?.status).toBe(BetStatus.WON);
    expect(bet2?.status).toBe(BetStatus.WON);
  });

  it("creates a BET_PAYOUT transaction for each winning bet", async () => {
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 200,
      houseEdgePct: 0,
      outcomes: [makeOutcome({ id: "winner", totalBetAmount: 200 })],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 200, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    const payoutTx = savedItems.find((i) => i.type === TransactionType.BET_PAYOUT);
    expect(payoutTx).toBeDefined();
    expect(payoutTx.amount).toBeCloseTo(200);
    expect(payoutTx.userId).toBe("u1");
  });

  it("creates a Settlement record with correct accounting", async () => {
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 500,
      houseEdgePct: 5,
      outcomes: [
        makeOutcome({ id: "winner", totalBetAmount: 300 }),
        makeOutcome({ id: "loser", totalBetAmount: 200 }),
      ],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 300, status: BetStatus.PENDING },
      { id: "b2", userId: "u2", outcomeId: "loser", amount: 200, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    const settlement = savedItems.find(
      (i) => i.marketId === "market-1" && i.winningOutcomeId !== undefined,
    );
    expect(settlement).toBeDefined();
    expect(settlement.totalPool).toBe(500);
    expect(settlement.houseAmount).toBeCloseTo(25); // 5% of 500
    expect(settlement.payoutPool).toBeCloseTo(475);
    expect(settlement.totalBets).toBe(2);
    expect(settlement.winningBets).toBe(1);
  });

  it("transitions market to SETTLED status after settlement", async () => {
    const market = makeMarket({
      status: MarketStatus.RESOLVING,
      totalPool: 100,
      houseEdgePct: 0,
      outcomes: [makeOutcome({ id: "winner", totalBetAmount: 100 })],
    });
    const winnerOutcome = market.outcomes[0];
    const bets = [
      { id: "b1", userId: "u1", outcomeId: "winner", amount: 100, status: BetStatus.PENDING },
    ];

    const { engine, savedItems } = makeResolvableEngine(bets, winnerOutcome, market);
    await engine.resolveMarket("market-1", "winner");

    const savedMarket = savedItems.find(
      (i) => i.id === "market-1" && i.status === MarketStatus.SETTLED,
    );
    expect(savedMarket).toBeDefined();
  });

  it("throws when market is not in RESOLVING state", async () => {
    const market = makeMarket({ status: MarketStatus.CLOSED });
    const mockMarketRepo = {
      findOne: jest.fn().mockResolvedValue({ ...market, outcomes: market.outcomes }),
      findOneBy: jest.fn().mockResolvedValue(market),
      save: jest.fn(),
    };

    const engine = new ParimutuelEngine(
      mockMarketRepo as any,
      null as any, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any, null as any,
    );

    await expect(
      engine.resolveMarket("market-1", "winner"),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when winning outcome is not in this market", async () => {
    const market = makeMarket({ status: MarketStatus.RESOLVING });
    const mockMarketRepo = {
      findOne: jest.fn().mockResolvedValue({ ...market, outcomes: market.outcomes }),
      save: jest.fn(),
    };

    const engine = new ParimutuelEngine(
      mockMarketRepo as any,
      null as any, null as any, null as any, null as any,
      null as any, null as any, null as any, null as any, null as any, null as any,
    );

    await expect(
      engine.resolveMarket("market-1", "nonexistent-outcome"),
    ).rejects.toThrow(BadRequestException);
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
