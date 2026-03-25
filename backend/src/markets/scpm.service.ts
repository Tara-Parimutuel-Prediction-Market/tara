import { Injectable } from "@nestjs/common";
import { Outcome } from "../entities/outcome.entity";
import { LMSRService } from "./lmsr.service";

export interface SCPMOrder {
  outcomeId: string;
  maxShares: number;
  limitPrice: number; // 0.0 to 1.0 (implied probability)
}

export interface SCPMFill {
  sharesFilled: number;
  totalCost: number;
  pricePerShare: number;
  newProbabilities: number[];
}

@Injectable()
export class SCPMService {
  constructor(private lmsrService: LMSRService) {}

  /**
   * Process an SCPM order
   * Finds the maximum shares that can be filled within the limit price
   */
  processOrder(
    outcomes: Outcome[],
    order: SCPMOrder,
    b: number = 1000,
  ): SCPMFill {
    const outcomeIdx = outcomes.findIndex((o) => o.id === order.outcomeId);
    if (outcomeIdx === -1) throw new Error("Outcome not found");

    const currentShares = outcomes.map((o) => Number(o.totalBetAmount));

    // Find max shares we can sell within the limit price using binary search
    const sharesFilled = this.maxSharesAtLimit(
      currentShares,
      outcomeIdx,
      order.limitPrice,
      b,
      order.maxShares,
    );

    // Calculate total cost
    const totalCost = this.costOfTrade(currentShares, outcomeIdx, sharesFilled, b);
    const pricePerShare = sharesFilled > 1e-9 ? totalCost / sharesFilled : 0;

    // Calculate new probabilities
    const newShares = [...currentShares];
    newShares[outcomeIdx] += sharesFilled;
    
    // We need a way to calculate probabilities from raw shares without Outcome entities
    // I'll add a helper for that or use the existing service if I can mock Outcome
    const newProbabilities = this.lmsrService.calculateProbabilities(
        newShares.map((s, i) => ({ totalBetAmount: s } as Outcome)),
        b
    );

    return {
      sharesFilled: parseFloat(sharesFilled.toFixed(4)),
      totalCost: parseFloat(totalCost.toFixed(4)),
      pricePerShare: parseFloat(pricePerShare.toFixed(4)),
      newProbabilities,
    };
  }

  /**
   * Binary search to find max shares such that average price <= limitPrice
   */
  private maxSharesAtLimit(
    currentShares: number[],
    outcomeIdx: number,
    limitPrice: number,
    b: number,
    maxRequested: number,
    tolerance: number = 1e-6,
  ): number {
    // Quick check: if even a tiny amount is too expensive, fill nothing
    const tinyCost = this.costOfTrade(currentShares, outcomeIdx, tolerance, b);
    if (tinyCost / tolerance > limitPrice) {
      return 0;
    }

    let lo = 0;
    let hi = maxRequested;

    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (mid < tolerance) break;

      const avgPrice = this.costOfTrade(currentShares, outcomeIdx, mid, b) / mid;
      if (avgPrice <= limitPrice) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    return lo;
  }

  /**
   * C(q_after) - C(q_before)
   */
  private costOfTrade(
    currentShares: number[],
    outcomeIdx: number,
    shares: number,
    b: number,
  ): number {
    const additionalBets = new Array(currentShares.length).fill(0);
    additionalBets[outcomeIdx] = shares;
    
    return this.lmsrService.calculateCost(
      currentShares.map(s => ({ totalBetAmount: s } as Outcome)),
      additionalBets,
      b
    );
  }
}
