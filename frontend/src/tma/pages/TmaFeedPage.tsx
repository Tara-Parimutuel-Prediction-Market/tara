import { FC, useState, useEffect } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, placeBet, type Market } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaPaymentModal } from "@/tma/components/TmaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { PoolDetails } from "@/components/PoolDetails";

function outcomeColor(rank: number, total: number): string {
  if (rank === 0) return "#22c55e";
  if (rank === total - 1 && total > 1) return "#ef4444";
  return "#f59e0b";
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

function MarketCard({ market, onBet, lastUpdated }: {
  market: Market;
  onBet: (outcomeId: string) => void;
  lastUpdated?: Date | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const countdown = useCountdown(market.closesAt);
  const totalPool = Number(market.totalPool);

  const sentiment = (() => {
    const raw = market.outcomes.map((o) => ({
      ...o,
      pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
    }));
    const sorted = [...raw].sort((a, b) => b.pct - a.pct);
    return raw.map((o) => {
      const rank = sorted.findIndex((s) => s.id === o.id);
      return { ...o, color: outcomeColor(rank, raw.length) };
    });
  })();

  const isBinary = sentiment.length <= 2;

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "14px",
      marginBottom: 10,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: "#111827" }}>
        {market.title}
      </div>

      {/* Outcomes */}
      {isBinary ? (
        <>
          {/* Probability display */}
          <div style={{ display: "flex", gap: 8 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.pct.toFixed(0)}%</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Probability bar */}
          <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", gap: 1 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ width: `${s.pct}%`, background: s.color, minWidth: s.pct > 0 ? 2 : 0 }} />
            ))}
          </div>
          {/* Bet buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {sentiment.map((s) => (
              <button
                key={s.id}
                onClick={() => onBet(s.id)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 9,
                  border: `1.5px solid ${s.color}`,
                  background: s.color, color: "#ffffff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  transition: "opacity 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Bet {s.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Multi-outcome: collapsible rows */
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {(showAll ? sentiment : sentiment.slice(0, 2)).map((s) => (
            <button
              key={s.id}
              onClick={() => onBet(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 9,
                border: "1.5px solid #e5e7eb",
                background: "#f9fafb", cursor: "pointer",
                transition: "all 0.12s", textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = s.color;
                e.currentTarget.style.background = `${s.color}0f`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.background = "#f9fafb";
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#111827", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              <div style={{ width: 48, height: 3, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ width: `${s.pct}%`, height: "100%", background: s.color }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: s.color, minWidth: 28, textAlign: "right", flexShrink: 0 }}>{s.pct.toFixed(0)}%</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#ffffff",
                background: s.color, borderRadius: 6, padding: "2px 7px", flexShrink: 0,
              }}>Bet</span>
            </button>
          ))}
          {sentiment.length > 2 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                padding: "6px 10px", borderRadius: 9,
                border: "1.5px solid #e5e7eb",
                background: "transparent", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: "#6b7280",
                textAlign: "center", transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#9ca3af"; e.currentTarget.style.color = "#374151"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; }}
            >
              {showAll ? "Show less" : `+${sentiment.length - 2} more`}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#9ca3af" }}>
        <PoolDetails market={market} lastUpdated={lastUpdated} />
        <span>{countdown}</span>
      </div>
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────

interface ActiveBet { marketId: string; outcomeId: string; }

export const TmaFeedPage: FC = () => {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => { setMarkets(d.filter((m) => m.status === "open")); setLastUpdated(new Date()); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    setMarkets((prev) => prev.map((m) => {
      if (m.id !== activeBet.marketId) return m;
      return {
        ...m,
        totalPool: String(Number(m.totalPool) + betAmt),
        outcomes: m.outcomes.map((o) =>
          o.id === activeBet.outcomeId
            ? { ...o, totalBetAmount: String(Number(o.totalBetAmount) + betAmt) }
            : o
        ),
      };
    }));

    const bet = activeBet;
    setActiveBet(null);

    const market = markets.find((m) => m.id === bet.marketId);
    if (market && user) {
      try { await placeBet(market.id, { outcomeId: bet.outcomeId, amount: betAmt }); }
      catch (e: any) { console.warn(e.message); }
    }

    getMarkets()
      .then((d) => { setMarkets(d.filter((m) => m.status === "open")); setLastUpdated(new Date()); })
      .catch(console.error);
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
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>No open predictions</div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>Check back soon.</div>
      </div>
    </Page>
  );

  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

  return (
    <Page>
      <div style={{ padding: "10px 10px 80px", background: "#f5f5f7", minHeight: "100vh" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 10, paddingLeft: 2 }}>
          {markets.length} open prediction{markets.length !== 1 ? "s" : ""}
        </div>
        {markets.map((market) => (
          <MarketCard
            key={market.id}
            market={market}
            onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
            lastUpdated={lastUpdated}
          />
        ))}
      </div>
      {activeMarket && activeBet && (
        <TmaPaymentModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={handlePaymentSuccess}
          onFailure={(e) => console.error(e)}
        />
      )}
    </Page>
  );
};
