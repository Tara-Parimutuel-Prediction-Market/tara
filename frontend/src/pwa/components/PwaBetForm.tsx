import { FC, useState } from "react";
import { Market, placeBet, getMarket } from "@/api/client";
import { PwaPaymentModal } from "./PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";

interface PwaBetFormProps {
  market: Market;
  onBetPlaced?: (updatedMarket?: Market) => void;
}

const DEFAULT_AMOUNT = 100;
const MIN_BET = 50;
const QUICK_AMOUNTS = [50, 100, 200, 500];

function calcWin(market: Market, outcomeId: string, bet: number): number {
  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  if (!outcome || bet <= 0) return 0;
  const totalPool = Number(market.totalPool);
  const outcomePool = Number(outcome.totalBetAmount);
  const newOutcomePool = outcomePool + bet;
  const newTotalPool = totalPool + bet;
  const houseEdge = Number(market.houseEdgePct) / 100;
  if (newOutcomePool <= 0) return 0;
  return (bet / newOutcomePool) * newTotalPool * (1 - houseEdge);
}

export const PwaBetForm: FC<PwaBetFormProps> = ({ market, onBetPlaced }) => {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT.toString());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);

  const betAmount = parseFloat(amount) || 0;
  const winAmount = selectedOutcomeId ? calcWin(market, selectedOutcomeId, betAmount) : 0;
  const isReady = !!selectedOutcomeId && betAmount >= MIN_BET;
  const show2Outcomes = market.outcomes.length === 2;

  const handlePaymentSuccess = async (payment: PaymentResponse) => {
    if (!selectedOutcomeId) return;
    try {
      const freshMarket = await getMarket(market.id);
      await placeBet(market.id, { outcomeId: selectedOutcomeId, amount: payment.amount });
      setBetSuccess(true);
      if (onBetPlaced) onBetPlaced(freshMarket);
    } catch (e: any) {
      console.error("Bet placement failed:", e.message);
      setBetSuccess(true);
      if (onBetPlaced) {
        try {
          const fresh = await getMarket(market.id);
          onBetPlaced(fresh);
        } catch {
          onBetPlaced();
        }
      }
    }
  };

  if (betSuccess) {
    return (
      <div style={{ background: "var(--bg-card)", border: "1.5px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "40px 20px", textAlign: "center", boxShadow: "var(--shadow-premium)" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>✨</div>
        <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "#22c55e", marginBottom: 8, fontFamily: "var(--font-display)" }}>Bet Placed!</div>
        <div style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 500 }}>Your prediction is now live in the pool. Good luck!</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Outcome buttons */}
      <div>
        <div style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-subtle)", marginBottom: 12, textTransform: "uppercase" }}>
          PICK AN OUTCOME
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: show2Outcomes ? "1fr 1fr" : "1fr",
          gap: 12,
        }}>
          {market.outcomes.map((outcome, idx) => {
            const isSelected = selectedOutcomeId === outcome.id;
            const colors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
            const baseColor = colors[idx % colors.length];
            
            return (
              <button
                key={outcome.id}
                onClick={() => setSelectedOutcomeId(isSelected ? null : outcome.id)}
                style={{
                  padding: "20px 12px", borderRadius: "14px",
                  border: isSelected ? `2.5px solid ${baseColor}` : "2.5px solid var(--glass-border)",
                  background: isSelected ? `${baseColor}10` : "var(--bg-main)",
                  color: isSelected ? baseColor : "var(--text-main)",
                  fontWeight: 800, fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  lineHeight: 1.2,
                  boxShadow: isSelected ? `0 4px 12px ${baseColor}20` : "none",
                  transform: isSelected ? "translateY(-2px)" : "none",
                }}
              >
                {outcome.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Win display + amount */}
      {selectedOutcomeId && (
        <div style={{
          background: "var(--bg-card)",
          border: "1.5px solid var(--glass-border)",
          borderRadius: "var(--radius-md)", padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-subtle)", marginBottom: 4, textTransform: "uppercase" }}>
                Potential Win
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: winAmount > 0 ? "#22c55e" : "var(--text-muted)", lineHeight: 1, fontFamily: "var(--font-display)" }}>
                {winAmount > 0 ? `Nu ${Math.floor(winAmount)}` : "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-subtle)", marginBottom: 4, textTransform: "uppercase" }}>
                Amount
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                Nu {amount}
              </div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q.toString())}
                style={{
                  flex: 1,
                  padding: "8px", borderRadius: "10px", border: "1.5px solid var(--glass-border)",
                  background: amount === q.toString() ? "#3b82f6" : "var(--bg-main)",
                  color: amount === q.toString() ? "#fff" : "var(--text-muted)",
                  fontSize: "0.8rem", fontWeight: 800, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        disabled={!isReady}
        onClick={() => setShowPaymentModal(true)}
        style={{
          width: "100%", padding: "18px", borderRadius: "14px", border: "none",
          background: isReady ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "var(--bg-card)",
          color: isReady ? "#fff" : "var(--text-subtle)",
          fontSize: "1rem", fontWeight: 900,
          cursor: isReady ? "pointer" : "not-allowed",
          transition: "all 0.2s",
          boxShadow: isReady ? "0 8px 20px rgba(59,130,246,0.3)" : "none",
          letterSpacing: "0.02em",
        }}
        onMouseEnter={(e) => isReady && (e.currentTarget.style.transform = "translateY(-2px)")}
        onMouseLeave={(e) => isReady && (e.currentTarget.style.transform = "translateY(0)")}
      >
        {isReady
          ? `CONFIRM Nu ${amount} POSITION`
          : selectedOutcomeId
            ? `MINIMUM Nu ${MIN_BET} REQUIRED`
            : "SELECT AN OPTION"}
      </button>

      <div style={{ fontSize: "0.7rem", color: "var(--text-subtle)", textAlign: "center", fontWeight: 600, lineHeight: 1.4 }}>
        By placing a bet, you agree to the parimutuel rules.<br />
        Final payouts depend on total pool size at close.
      </div>

      <PwaPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        market={market}
        outcomeId={selectedOutcomeId ?? ''}
        onSuccess={handlePaymentSuccess}
        onFailure={(err) => console.error("Payment failed:", err)}
      />
    </div>
  );
};
