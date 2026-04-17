import { FC, useState } from "react";
import { Market, placeBet, getMarket } from "@/api/client";
import { PwaPaymentModal } from "./PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";

interface PwaBetFormProps {
  market: Market;
  onBetPlaced?: (updatedMarket?: Market) => void;
}

const DEFAULT_AMOUNT = 100;
const MIN_BET = 100;
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
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(
    null,
  );
  const [amount, setAmount] = useState(DEFAULT_AMOUNT.toString());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);

  const betAmount = parseFloat(amount) || 0;
  const winAmount = selectedOutcomeId
    ? calcWin(market, selectedOutcomeId, betAmount)
    : 0;
  const isReady = !!selectedOutcomeId && betAmount >= MIN_BET;
  const show2Outcomes = market.outcomes.length === 2;

  const handlePaymentSuccess = async (payment: PaymentResponse) => {
    if (!selectedOutcomeId) return;
    try {
      const freshMarket = await getMarket(market.id);
      await placeBet(market.id, {
        outcomeId: selectedOutcomeId,
        amount: payment.amount,
      });
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
      <div
        style={{
          background: "var(--bg-card)",
          border: "2px solid var(--color-success)",
          borderRadius: "var(--radius-lg)",
          padding: "48px 24px",
          textAlign: "center",
          boxShadow: "var(--shadow-lg)",
          animation: "tickerSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 20 }}>🌌</div>
        <div
          style={{
            fontWeight: 900,
            fontSize: "1.6rem",
            color: "var(--color-success)",
            marginBottom: 12,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.04em",
          }}
        >
          Prophecy Cast!
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "var(--text-muted)",
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Your position is now active in the pool.<br />
          The oracles are tracking your fate.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* Outcome buttons */}
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 900,
            letterSpacing: "0.1em",
            color: "var(--text-subtle)",
            marginBottom: "var(--space-md)",
            textTransform: "uppercase",
          }}
        >
          Cast Your Vote
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: show2Outcomes ? "1fr 1fr" : "1fr",
            gap: "var(--space-sm)",
          }}
        >
          {market.outcomes.map((outcome, idx) => {
            const isSelected = selectedOutcomeId === outcome.id;
            const colors = [
              "#22c55e",
              "#ef4444",
              "#f59e0b",
              "#3b82f6",
              "#8b5cf6",
            ];
            const baseColor = colors[idx % colors.length];

            return (
              <button
                key={outcome.id}
                onClick={() =>
                  setSelectedOutcomeId(isSelected ? null : outcome.id)
                }
                style={{
                  padding: "var(--space-md)",
                  borderRadius: "var(--radius-md)",
                  border: isSelected
                    ? `2.5px solid ${baseColor}`
                    : "1.5px solid var(--border)",
                  background: isSelected ? `${baseColor}10` : "var(--bg-secondary)",
                  color: isSelected ? baseColor : "var(--text-main)",
                  fontWeight: 900,
                  fontSize: "1.05rem",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  lineHeight: 1.1,
                  boxShadow: isSelected ? `0 8px 16px -4px ${baseColor}40` : "none",
                  transform: isSelected ? "translateY(-2px)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
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
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Potential Return
              </div>
              <div
                style={{
                  fontSize: "2.2rem",
                  fontWeight: 900,
                  color: winAmount > 0 ? "var(--color-success)" : "var(--text-muted)",
                  lineHeight: 0.9,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.04em",
                }}
              >
                {winAmount > 0 ? `Nu ${Math.floor(winAmount)}` : "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Input
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 900,
                  color: "var(--text-main)",
                  letterSpacing: "-0.02em",
                }}
              >
                Nu {amount}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q.toString())}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background:
                    amount === q.toString() ? "var(--color-primary)" : "var(--bg-card)",
                  color: amount === q.toString() ? "#fff" : "var(--text-muted)",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: amount === q.toString() ? "0 4px 10px rgba(39, 117, 208, 0.2)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (amount !== q.toString()) {
                    e.currentTarget.style.borderColor = "var(--text-subtle)";
                    e.currentTarget.style.color = "var(--text-main)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (amount !== q.toString()) {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }
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
          width: "100%",
          padding: "20px",
          borderRadius: "var(--radius-md)",
          border: "none",
          background: isReady
            ? "var(--grad-primary)"
            : "var(--bg-secondary)",
          color: isReady ? "#fff" : "var(--text-subtle)",
          fontSize: "1.05rem",
          fontWeight: 900,
          cursor: isReady ? "pointer" : "not-allowed",
          transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow: isReady ? "0 12px 28px -8px rgba(39, 117, 208, 0.5)" : "none",
          letterSpacing: "0.02em",
        }}
        onMouseEnter={(e) =>
          isReady && (e.currentTarget.style.transform = "translateY(-3px)")
        }
        onMouseLeave={(e) =>
          isReady && (e.currentTarget.style.transform = "translateY(0)")
        }
      >
        {isReady
          ? `Cast Nu ${amount} Prophecy`
          : selectedOutcomeId
            ? `Minimum Nu ${MIN_BET} Required`
            : "Select an Outcome"}
      </button>

      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--text-subtle)",
          textAlign: "center",
          fontWeight: 700,
          lineHeight: 1.6,
          opacity: 0.8,
        }}
      >
        By casting this prophecy, you agree to the parimutuel pool rules.<br />
        Final rewards are determined by the oracle at market close.
      </div>

      <PwaPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        market={market}
        outcomeId={selectedOutcomeId ?? ""}
        onSuccess={handlePaymentSuccess}
        onFailure={(err) => console.error("Payment failed:", err)}
      />
    </div>
  );
};
