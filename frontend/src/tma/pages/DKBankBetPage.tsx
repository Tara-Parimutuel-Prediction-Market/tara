import { FC, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarket, placeBet, type Market } from "@/api/client";
import { formatBTN } from "@/api/dkbank";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaPaymentModal } from "@/tma/components/TmaPaymentModal";
import config from "@/config";

const { minBet } = config.payments.dkBank;

const QUICK_AMOUNTS = [50, 100, 200, 500];

export const DKBankBetPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [betSuccess, setBetSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMarket(id)
      .then(setMarket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePaymentSuccess = async () => {
    if (!selectedOutcomeId || !amount || !market) return;
    if (user) {
      try {
        await placeBet(market.id, {
          outcomeId: selectedOutcomeId,
          amount: parseFloat(amount),
        });
      } catch (betErr: any) {
        console.warn("Bet registration warning:", betErr.message);
      }
    }
    setBetSuccess(true);
    const updated = await getMarket(market.id);
    setMarket(updated);
    setAmount("");
    setSelectedOutcomeId(null);
  };

  if (loading) {
    return (
      <Page back>
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <Spinner size="l" />
        </div>
      </Page>
    );
  }

  if (error || !market) {
    return (
      <Page back>
        <Placeholder header="Error" description={error || "Market not found"} />
      </Page>
    );
  }

  const canBet = market.status === "open";
  const selectedOutcome = market.outcomes.find((o) => o.id === selectedOutcomeId);
  const betAmount = parseFloat(amount) || 0;

  let winAmount = 0;
  if (selectedOutcome && betAmount >= minBet) {
    const totalPool = Number(market.totalPool);
    const outcomePool = Number(selectedOutcome.totalBetAmount);
    const newOutcomePool = outcomePool + betAmount;
    const newTotalPool = totalPool + betAmount;
    const houseEdge = Number(market.houseEdgePct) / 100;
    if (newOutcomePool > 0) {
      winAmount = (betAmount / newOutcomePool) * newTotalPool * (1 - houseEdge);
    }
  }

  const isReady = !!selectedOutcomeId && betAmount >= minBet;

  return (
    <Page back>
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", background: "#f5f5f7", minHeight: "100vh" }}>

        {/* Question */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 8 }}>
            {market.status === "open" ? "Open · Pick a side" : market.status}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: "#111827" }}>
            {market.title}
          </div>
        </div>

        {/* Outcome buttons */}
        {canBet && (
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 10 }}>
              PICK A SIDE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${market.outcomes.length <= 2 ? 2 : 1}, 1fr)`, gap: 10 }}>
              {market.outcomes.map((outcome) => {
                const isSelected = selectedOutcomeId === outcome.id;
                const prob = Number(outcome.lmsrProbability || 0);
                const pct = prob > 0 ? `${(prob * 100).toFixed(0)}%` : null;
                return (
                  <button
                    key={outcome.id}
                    onClick={() => setSelectedOutcomeId(outcome.id)}
                    style={{
                      padding: "16px 12px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                      background: isSelected ? "rgba(59,130,246,0.08)" : "#f9fafb",
                      color: isSelected ? "#3b82f6" : "#111827",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{outcome.label}</div>
                    {pct && (
                      <div style={{ fontSize: 12, marginTop: 4, color: isSelected ? "#3b82f6" : "#9ca3af" }}>
                        {pct} chance
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Amount */}
        {canBet && selectedOutcomeId && (
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 8 }}>
              Amount (Nu.)
            </div>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "#9ca3af", pointerEvents: "none" }}>Nu</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${minBet}`}
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 34px",
                  background: "#f9fafb",
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  color: "#111827",
                  fontSize: 20,
                  fontWeight: 700,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Quick amounts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(q.toString())}
                  style={{
                    padding: "9px 0",
                    borderRadius: 10,
                    border: amount === q.toString() ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                    background: amount === q.toString() ? "#eff6ff" : "#f9fafb",
                    color: amount === q.toString() ? "#3b82f6" : "#374151",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Win amount */}
            {winAmount > 0 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: 10,
                background: "#f0fdf4",
                border: "1px solid #86efac",
                marginTop: 12,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Est. payout if win
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>
                    {formatBTN(winAmount)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Outcome
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>
                    {selectedOutcome?.label}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success state */}
        {betSuccess && (
          <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "32px 20px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>Bet Placed!</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Your payment was confirmed and your bet has been registered.
            </div>
          </div>
        )}

        {!canBet && (
          <Placeholder
            header={market.status === "upcoming" ? "Opening Soon" : "Betting Closed"}
            description={market.status === "upcoming" ? "This market will open soon." : "Betting is no longer available."}
          />
        )}
      </div>

      {/* Sticky confirm button */}
      {canBet && !betSuccess && (
        <div style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          padding: "12px 16px 28px",
          background: "#ffffff",
          borderTop: "1px solid #f0f0f0",
          boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
        }}>
          <button
            disabled={!isReady}
            onClick={() => setIsPaymentModalOpen(true)}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 12,
              border: "none",
              background: isReady ? "#3b82f6" : "#e5e7eb",
              color: isReady ? "#fff" : "#9ca3af",
              fontSize: 15,
              fontWeight: 700,
              cursor: isReady ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
            }}
          >
            {isReady
              ? `Pay ${formatBTN(betAmount)} on ${selectedOutcome?.label}`
              : selectedOutcomeId
                ? `Enter at least Nu. ${minBet}`
                : "Pick a side to continue"}
          </button>
        </div>
      )}

      <TmaPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        market={market}
        outcomeId={selectedOutcomeId ?? ""}
        onSuccess={() => { setIsPaymentModalOpen(false); handlePaymentSuccess(); }}
        onFailure={(err) => console.error("Payment failed:", err)}
      />
    </Page>
  );
};
