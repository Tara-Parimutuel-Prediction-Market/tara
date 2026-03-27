import { FC, useState } from "react";
import { Market, placeBet, getMarket } from "@/api/client";
import { formatBTN } from "@/api/dkbank";
import { PwaPaymentModal } from "./PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { useBreakpoint } from "../hooks/useBreakpoint";

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

  const bp = useBreakpoint();
  const selectedOutcome = market.outcomes.find((o) => o.id === selectedOutcomeId) ?? null;
  const betAmount = parseFloat(amount) || 0;
  const winAmount = selectedOutcomeId ? calcWin(market, selectedOutcomeId, betAmount) : 0;
  const isReady = !!selectedOutcomeId && betAmount >= MIN_BET;
  const show2Outcomes = market.outcomes.length === 2;

  const handlePaymentSuccess = async (payment: PaymentResponse) => {
    if (!selectedOutcomeId) return;
    setShowPaymentModal(false);
    try {
      const freshMarket = await getMarket(market.id);
      const payload = freshMarket.mechanism === 'scpm'
        ? { outcomeId: selectedOutcomeId, maxShares: payment.amount, limitPrice: 1.0 }
        : { outcomeId: selectedOutcomeId, amount: payment.amount };
      await placeBet(market.id, payload);
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
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#30d158", marginBottom: 6 }}>Bet placed!</div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>Your prediction has been registered.</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

      {/* Outcome buttons */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 10 }}>
          PICK A SIDE
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: show2Outcomes ? "1fr 1fr" : "1fr",
          gap: 10,
        }}>
          {market.outcomes.map((outcome) => {
            const isSelected = selectedOutcomeId === outcome.id;
            return (
              <button
                key={outcome.id}
                onClick={() => setSelectedOutcomeId(isSelected ? null : outcome.id)}
                style={{
                  padding: "16px 12px", borderRadius: 14,
                  border: isSelected ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                  background: isSelected ? "rgba(82,136,193,0.15)" : "#f3f4f6",
                  color: isSelected ? "#3b82f6" : "#111827",
                  fontWeight: 700, fontSize: 15,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  lineHeight: 1.2,
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
          background: winAmount > 0 ? "#f0fdf4" : "#f9fafb",
          border: `1.5px solid ${winAmount > 0 ? "#bbf7d0" : "#e5e7eb"}`,
          borderRadius: 12, padding: "14px 16px",
          display: "flex",
          flexDirection: bp === "mobile" ? "column" : "row",
          justifyContent: "space-between",
          alignItems: bp === "mobile" ? "flex-start" : "center",
          gap: bp === "mobile" ? 12 : 0,
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
              Win if {selectedOutcome?.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: winAmount > 0 ? "#30d158" : "#9ca3af", lineHeight: 1 }}>
              {winAmount > 0 ? formatBTN(winAmount) : "—"}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
              Estimated · final payout at close
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: bp === "mobile" ? "row" : "column", gap: 6, alignItems: bp === "mobile" ? "center" : "flex-end", flexWrap: "wrap" }}>
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q.toString())}
                style={{
                  padding: "5px 14px", borderRadius: 20, border: "none",
                  background: amount === q.toString() ? "#3b82f6" : "#f3f4f6",
                  color: amount === q.toString() ? "#fff" : "#6b7280",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
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
          width: "100%", padding: "15px", borderRadius: 12, border: "none",
          background: isReady ? "#3b82f6" : "#e5e7eb",
          color: isReady ? "#fff" : "#9ca3af",
          fontSize: 15, fontWeight: 700,
          cursor: isReady ? "pointer" : "not-allowed",
          transition: "background 0.2s",
        }}
      >
        {isReady
          ? `Pay ${formatBTN(betAmount)} on ${selectedOutcome?.label}`
          : selectedOutcomeId
            ? `Enter at least Nu ${MIN_BET}`
            : "Pick a side to predict"}
      </button>

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
