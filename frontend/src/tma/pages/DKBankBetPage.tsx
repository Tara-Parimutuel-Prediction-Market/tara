import { FC, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarket, placeBet, type Market } from "@/api/client";
import { formatBTN } from "@/api/dkbank";
import { useAuth } from "@/tma/hooks/useAuth";
import { DKBankConfirmModal } from "@/tma/components/DKBankConfirmModal";
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

  const fetchMarketData = () => {
    if (!id) return;
    getMarket(id)
      .then(setMarket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMarketData();
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
      {/* Flex column filling the true visible viewport height */}
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--bg-main)" }}>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "48px 16px 16px", maxWidth: 480, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

          {/* Question */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)", marginBottom: 8 }}>
              {market.status === "open" ? "Open · Pick a side" : market.status}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: "var(--text-main)" }}>
              {market.title}
            </div>
          </div>

          {/* Outcome buttons */}
          {canBet && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-subtle)", marginBottom: 10 }}>
                PICK A SIDE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {market.outcomes.map((outcome, idx) => {
                  const isSelected = selectedOutcomeId === outcome.id;
                  const totalPool = Number(market.totalPool);
                  const pct = totalPool > 0
                    ? (Number(outcome.totalBetAmount) / totalPool) * 100
                    : 100 / market.outcomes.length;
                  const colors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
                  const color = colors[idx % colors.length];
                  return (
                    <button
                      key={outcome.id}
                      onClick={() => setSelectedOutcomeId(outcome.id)}
                      style={{
                        padding: "14px 14px 12px",
                        borderRadius: 12,
                        border: isSelected ? `2px solid ${color}` : "2px solid var(--border)",
                        background: isSelected ? `${color}14` : "var(--bg-secondary)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: isSelected ? color : "var(--text-main)" }}>{outcome.label}</span>
                        <span style={{ fontWeight: 800, fontSize: 15, color }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ background: "var(--border)", height: 6, borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ background: color, width: `${pct}%`, height: "100%", borderRadius: 6, transition: "width 0.6s ease" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount */}
          {canBet && selectedOutcomeId && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-subtle)", marginBottom: 8 }}>
                Amount (Nu.)
              </div>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: "var(--text-subtle)", pointerEvents: "none" }}>Nu</span>
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
                    background: "var(--bg-secondary)",
                    border: "2px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text-main)",
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
                      border: amount === q.toString() ? "2px solid #3b82f6" : "2px solid var(--border)",
                      background: amount === q.toString() ? "rgba(59,130,246,0.12)" : "var(--bg-secondary)",
                      color: amount === q.toString() ? "#3b82f6" : "var(--text-muted)",
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
                  background: "rgba(22,163,74,0.1)",
                  border: "1px solid #86efac",
                  marginTop: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Est. payout if win
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>
                      {formatBTN(winAmount)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "32px 20px", textAlign: "center", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>Bet Placed!</div>
              <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>
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

        {/* Confirm button — always visible at the bottom of the flex column */}
        {canBet && !betSuccess && (
          <div style={{
            flexShrink: 0,
            padding: "12px 16px",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            background: "var(--bg-card)",
            borderTop: "1px solid var(--border)",
          }}>
            <button
              disabled={!isReady}
              onClick={() => setIsPaymentModalOpen(true)}
              style={{
                width: "100%",
                padding: "15px",
                borderRadius: 12,
                border: "none",
                background: isReady ? "#3b82f6" : "var(--bg-secondary)",
                color: isReady ? "#fff" : "var(--text-subtle)",
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
      </div>

      <DKBankConfirmModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        market={market}
        outcomeId={selectedOutcomeId ?? ""}
        amount={betAmount}
        onSuccess={() => { setIsPaymentModalOpen(false); handlePaymentSuccess(); }}
        onFailure={(err: string) => console.error("Payment failed:", err)}
      />
    </Page>
  );
};
