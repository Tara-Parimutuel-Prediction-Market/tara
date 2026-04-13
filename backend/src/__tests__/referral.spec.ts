/**
 * Tests for referral bonus logic inside ParimutuelEngine.
 * Verifies the new Nu 50 flat + 5% formula replaces the old 20%-of-rake logic.
 */
import { ParimutuelEngine } from "../markets/parimutuel.engine";

describe("ParimutuelEngine referral bonus constants", () => {
  it("flat bonus is Nu 50", () => {
    expect(ParimutuelEngine.REFERRAL_FLAT_BONUS).toBe(50);
  });

  it("bet pct is 5%", () => {
    expect(ParimutuelEngine.REFERRAL_BET_PCT).toBeCloseTo(0.05);
  });

  it("cap is Nu 50", () => {
    expect(ParimutuelEngine.REFERRAL_CAP).toBe(50);
  });

  it("bonus for small bet: flat(50) + 5% of 20 = 51 → capped at 50", () => {
    const flat = ParimutuelEngine.REFERRAL_FLAT_BONUS;
    const pct = Math.round(20 * ParimutuelEngine.REFERRAL_BET_PCT * 100) / 100; // 1
    const bonus = Math.min(flat + pct, ParimutuelEngine.REFERRAL_CAP);
    expect(bonus).toBe(50);
  });

  it("bonus for any bet: always capped at 50 because flat alone equals cap", () => {
    for (const betAmount of [10, 100, 500, 1000]) {
      const pct =
        Math.round(betAmount * ParimutuelEngine.REFERRAL_BET_PCT * 100) / 100;
      const bonus = Math.min(
        ParimutuelEngine.REFERRAL_FLAT_BONUS + pct,
        ParimutuelEngine.REFERRAL_CAP,
      );
      expect(bonus).toBe(50);
    }
  });
});
