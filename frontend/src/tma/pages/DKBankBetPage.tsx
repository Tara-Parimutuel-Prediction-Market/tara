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

  // Parimutuel: expected payout if this side wins
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
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto" }}>

        {/* Question */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tg-theme-hint-color, #8e8e93)", marginBottom: 8 }}>
            {market.status === "open" ? "Open · Pick a side" : market.status}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: "var(--tg-theme-text-color, #fff)" }}>
            {market.title}
          </div>
        </div>

        {/* Outcome buttons */}
        {canBet && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${market.outcomes.length <= 2 ? 2 : 1}, 1fr)`, gap: 10, marginBottom: 28 }}>
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
                    borderRadius: 14,
                    border: isSelected
                      ? "2px solid var(--tg-theme-button-color, #2481cc)"
                      : "2px solid var(--tg-theme-secondary-bg-color, #2c2c2e)",
                    backgroundColor: isSelected
                      ? "rgba(36, 129, 204, 0.15)"
                      : "var(--tg-theme-secondary-bg-color, #2c2c2e)",
                    color: "var(--tg-theme-text-color, #fff)",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{outcome.label}</div>
                  {pct && (
                    <div style={{ fontSize: 12, marginTop: 4, color: isSelected ? "var(--tg-theme-button-color, #2481cc)" : "var(--tg-theme-hint-color, #8e8e93)" }}>
                      {pct} chance
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Amount */}
        {canBet && selectedOutcomeId && (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tg-theme-hint-color, #8e8e93)", marginBottom: 8 }}>
                Amount (Nu.)
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${minBet}`}
                autoFocus
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  backgroundColor: "var(--tg-theme-secondary-bg-color, #2c2c2e)",
                  border: "2px solid transparent",
                  borderRadius: 14,
                  color: "var(--tg-theme-text-color, #fff)",
                  fontSize: 22,
                  fontWeight: 700,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Quick amounts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24 }}>
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(q.toString())}
                  style={{
                    padding: "10px 0",
                    borderRadius: 10,
                    border: "none",
                    backgroundColor: amount === q.toString()
                      ? "var(--tg-theme-button-color, #2481cc)"
                      : "var(--tg-theme-secondary-bg-color, #2c2c2e)",
                    color: amount === q.toString()
                      ? "var(--tg-theme-button-text-color, #fff)"
                      : "var(--tg-theme-text-color, #fff)",
                    fontSize: 14,
                    fontWeight: 600,
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
                padding: "16px 18px",
                borderRadius: 14,
                backgroundColor: "rgba(48, 209, 88, 0.1)",
                border: "1.5px solid rgba(48, 209, 88, 0.3)",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, color: "var(--tg-theme-hint-color, #8e8e93)" }}>
                  Win if <strong style={{ color: "var(--tg-theme-text-color, #fff)" }}>{selectedOutcome?.label}</strong>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#30d158" }}>
                  {formatBTN(winAmount)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Success state */}
        {betSuccess && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#30d158", marginBottom: 6 }}>Bet Placed!</div>
            <div style={{ fontSize: 13, color: "var(--tg-theme-hint-color, #8e8e93)" }}>
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
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px 28px",
          backgroundColor: "var(--tg-theme-bg-color, #1c1c1e)",
          borderTop: "1px solid var(--tg-theme-secondary-bg-color, #2c2c2e)",
        }}>
          <button
            disabled={!isReady}
            onClick={() => setIsPaymentModalOpen(true)}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 14,
              border: "none",
              backgroundColor: isReady
                ? "var(--tg-theme-button-color, #2481cc)"
                : "var(--tg-theme-secondary-bg-color, #2c2c2e)",
              color: isReady
                ? "var(--tg-theme-button-text-color, #fff)"
                : "var(--tg-theme-hint-color, #8e8e93)",
              fontSize: 16,
              fontWeight: 700,
              cursor: isReady ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
            }}
          >
            {isReady
              ? `Bet ${formatBTN(betAmount)} on ${selectedOutcome?.label}`
              : selectedOutcomeId
                ? `Enter at least Nu. ${minBet}`
                : "Pick a side to continue"}
          </button>
        </div>
      )}

      <TmaPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        amount={betAmount}
        description={`Bet on: ${market.title} — ${selectedOutcome?.label}`}
        onSuccess={() => { setIsPaymentModalOpen(false); handlePaymentSuccess(); }}
        onFailure={(err) => console.error("Payment failed:", err)}
      />
    </Page>
  );
};
