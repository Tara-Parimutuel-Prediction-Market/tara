import { FC, useState, useEffect } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, placeBet, type Market } from "@/api/client";
import { formatBTN } from "@/api/dkbank";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaPaymentModal } from "@/tma/components/TmaPaymentModal";
import config from "@/config";

const DEFAULT_AMOUNT = 100;
const QUICK_AMOUNTS = [50, 100, 200, 500];
const COLORS = ["#2481cc", "#e05c5c", "#30d158", "#e8a838"];

function calcWin(market: Market, outcomeId: string, bet: number): number {
  const o = market.outcomes.find((x) => x.id === outcomeId);
  if (!o || bet <= 0) return 0;
  const tp = Number(market.totalPool), op = Number(o.totalBetAmount);
  const newOp = op + bet, newTp = tp + bet;
  const edge = Number(market.houseEdgePct) / 100;
  return newOp > 0 ? (bet / newOp) * newTp * (1 - edge) : 0;
}

function useCountdown(closesAt: string | null): string {
  const [label, setLabel] = useState("Open");
  useEffect(() => {
    if (!closesAt) return;
    const tick = () => {
      const ms = new Date(closesAt).getTime() - Date.now();
      if (ms <= 0) { setLabel("Closing"); return; }
      const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(h > 24 ? `${Math.floor(h / 24)}d left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [closesAt]);
  return label;
}

interface CardState { outcomeId: string | null; amount: string; success: boolean; }

function MarketCard({ market, state, onSelectOutcome, onSelectAmount, onPay }: {
  market: Market; state: CardState;
  onSelectOutcome: (id: string) => void;
  onSelectAmount: (a: string) => void;
  onPay: () => void;
}) {
  const { outcomeId, amount, success } = state;
  const countdown = useCountdown(market.closesAt);
  const selectedOutcome = market.outcomes.find((o) => o.id === outcomeId);
  const selectedIdx = market.outcomes.findIndex((o) => o.id === outcomeId);
  const selectedColor = COLORS[selectedIdx] ?? COLORS[0];
  const betAmount = parseFloat(amount) || 0;
  const winAmount = outcomeId ? calcWin(market, outcomeId, betAmount) : 0;
  const isReady = !!outcomeId && betAmount >= config.payments.dkBank.minBet;
  const totalPool = Number(market.totalPool);

  const sentiment = market.outcomes.map((o, i) => ({
    ...o,
    pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
    color: COLORS[i] ?? COLORS[COLORS.length - 1],
  }));

  const hint = "var(--tg-theme-hint-color, #8e8e93)";
  const textColor = "var(--tg-theme-text-color, #fff)";
  const cardBg = "var(--tg-theme-secondary-bg-color, #1c1c1e)";

  return (
    <div style={{ background: cardBg, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "16px 14px 12px", marginBottom: 10 }}>

      {/* Question */}
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: textColor, marginBottom: 12 }}>
        {market.title}
      </div>

      {/* Outcome buttons — probability lives inside */}
      <div style={{ display: "grid", gridTemplateColumns: market.outcomes.length <= 2 ? "1fr 1fr" : "1fr", gap: 8 }}>
        {sentiment.map((s, i) => {
          const sel = outcomeId === s.id;
          const previewWin = calcWin(market, s.id, DEFAULT_AMOUNT);
          return (
            <button key={s.id} onClick={() => onSelectOutcome(s.id)} style={{
              padding: "11px 12px",
              borderRadius: 10,
              border: `1.5px solid ${sel ? s.color : "rgba(255,255,255,0.08)"}`,
              background: sel ? `${s.color}1a` : "rgba(255,255,255,0.04)",
              cursor: "pointer", textAlign: "left",
              transition: "all 0.15s",
            }}>
              {/* Label + probability on same row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: sel ? s.color : textColor }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 15, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                  {s.pct.toFixed(0)}%
                </span>
              </div>
              {/* Win preview */}
              {previewWin > 0 && (
                <div style={{ fontSize: 11, color: sel ? s.color : "#30d158", marginTop: 4, fontWeight: 600 }}>
                  Win {formatBTN(previewWin)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Probability bar — thin, right under buttons */}
      <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 2, marginTop: 8 }}>
        {sentiment.map((s) => (
          <div key={s.id} style={{ width: `${s.pct}%`, background: s.color, transition: "width 0.4s ease", minWidth: s.pct > 0 ? 3 : 0 }} />
        ))}
      </div>

      {/* Confirm strip */}
      {outcomeId && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Win hero */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: hint }}>
                Win if <span style={{ color: selectedColor, fontWeight: 700 }}>{selectedOutcome?.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#30d158", lineHeight: 1.1 }}>
                {winAmount > 0 ? formatBTN(winAmount) : "—"}
              </div>
              <div style={{ fontSize: 10, color: hint, marginTop: 2 }}>Estimated · final at close</div>
            </div>
            {/* Amount chips stacked vertically on right */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
              {QUICK_AMOUNTS.map((q) => {
                const sel = amount === q.toString();
                return (
                  <button key={q} onClick={() => onSelectAmount(q.toString())} style={{
                    padding: "4px 13px", borderRadius: 20, border: "none",
                    background: sel ? selectedColor : "rgba(255,255,255,0.08)",
                    color: sel ? "#fff" : hint,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>{q}</button>
                );
              })}
            </div>
          </div>

          {success && <div style={{ textAlign: "center", marginBottom: 8, fontWeight: 700, color: "#30d158" }}>✅ Bet placed!</div>}

          <button disabled={!isReady || success} onClick={onPay} style={{
            width: "100%", padding: "13px", borderRadius: 11, border: "none",
            background: isReady && !success ? selectedColor : "rgba(255,255,255,0.06)",
            color: isReady && !success ? "#fff" : hint,
            fontSize: 14, fontWeight: 700,
            cursor: isReady && !success ? "pointer" : "not-allowed",
          }}>
            {success ? "Bet placed ✓" : isReady ? `Pay ${formatBTN(betAmount)} on ${selectedOutcome?.label}` : `Min Nu ${config.payments.dkBank.minBet}`}
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: hint }}>
        <span>Nu {totalPool.toLocaleString()} pool</span>
        <span>{countdown}</span>
      </div>
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────

export const TmaFeedPage: FC = () => {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => setMarkets(d.filter((m) => m.status === "open")))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getCard = (id: string): CardState =>
    cardStates[id] ?? { outcomeId: null, amount: DEFAULT_AMOUNT.toString(), success: false };

  const setCard = (id: string, fields: Partial<CardState>) =>
    setCardStates((p) => ({ ...p, [id]: { ...getCard(id), ...fields } }));

  const handlePaymentSuccess = async () => {
    if (!activeMarketId) return;
    const market = markets.find((m) => m.id === activeMarketId);
    const { outcomeId, amount } = getCard(activeMarketId);
    if (market && outcomeId && user) {
      try { await placeBet(market.id, { outcomeId, amount: parseFloat(amount) }); }
      catch (e: any) { console.warn(e.message); }
    }
    const mid = activeMarketId;
    setActiveMarketId(null);
    setCard(mid, { success: true });
    setTimeout(() => setCard(mid, { outcomeId: null, success: false }), 2000);
  };

  if (loading) return (
    <Page>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Spinner size="l" />
      </div>
    </Page>
  );

  if (!markets.length) return (
    <Page>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12, textAlign: "center", padding: "0 32px" }}>
        <div style={{ fontSize: 48 }}>🔮</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--tg-theme-text-color, #fff)" }}>No open predictions</div>
        <div style={{ fontSize: 13, color: "var(--tg-theme-hint-color, #8e8e93)" }}>Check back soon.</div>
      </div>
    </Page>
  );

  const activeMarket = activeMarketId ? markets.find((m) => m.id === activeMarketId) : null;
  const activeCard = activeMarketId ? getCard(activeMarketId) : null;
  const activeOutcome = activeMarket?.outcomes.find((o) => o.id === activeCard?.outcomeId);

  return (
    <Page>
      <div style={{ padding: "10px 10px 80px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tg-theme-hint-color, #8e8e93)", marginBottom: 10, paddingLeft: 2 }}>
          {markets.length} open prediction{markets.length !== 1 ? "s" : ""}
        </div>
        {markets.map((market) => (
          <MarketCard key={market.id} market={market} state={getCard(market.id)}
            onSelectOutcome={(id) => setCard(market.id, { outcomeId: getCard(market.id).outcomeId === id ? null : id })}
            onSelectAmount={(a) => setCard(market.id, { amount: a })}
            onPay={() => setActiveMarketId(market.id)}
          />
        ))}
      </div>
      {activeMarket && activeCard && (
        <TmaPaymentModal
          isOpen={!!activeMarketId}
          onClose={() => setActiveMarketId(null)}
          amount={parseFloat(activeCard.amount) || 0}
          description={`Predict: ${activeMarket.title} — ${activeOutcome?.label}`}
          onSuccess={handlePaymentSuccess}
          onFailure={(e) => console.error(e)}
        />
      )}
    </Page>
  );
};
