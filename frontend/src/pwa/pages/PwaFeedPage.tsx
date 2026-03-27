import { useState, useEffect } from "react";
import { getMarkets, placeBet, type Market } from "@/api/client";
import { PwaPaymentModal } from "../components/PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { useBreakpoint } from "../hooks/useBreakpoint";
function outcomeColor(rank: number, total: number): string {
  if (rank === 0) return "#22c55e";                          // highest → green
  if (rank === total - 1 && total > 1) return "#ef4444";    // lowest  → red
  return "#f59e0b";                                          // middle  → amber
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

// ── Market Card ────────────────────────────────────────────────────────────────

function MarketCard({ market, onBet }: {
  market: Market;
  onBet: (outcomeId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const isUpcoming = market.status === "upcoming";
  const countdown = useCountdown(isUpcoming ? market.opensAt ?? null : market.closesAt);
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
      border: isUpcoming ? "1px solid #dbeafe" : "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "14px",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      boxSizing: "border-box",
      gap: 10,
      position: "relative",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      {isUpcoming && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "linear-gradient(90deg, #3b82f6, #2563eb)",
          color: "#fff", padding: "2px 8px", fontSize: "0.55rem", fontWeight: 800,
          borderBottomLeftRadius: 8, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>Soon</div>
      )}

      {/* Title */}
      <div style={{
        fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: "#111827",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", minHeight: "2.7em",
      }}>
        {market.title}
      </div>

      {/* Outcomes */}
      {isUpcoming ? (
        <div style={{ display: "flex", gap: 8 }}>
          {sentiment.map((s) => (
            <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#d1d5db" }}>—</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : isBinary ? (
        <>
          {/* Probability bars */}
          <div style={{ display: "flex", gap: 8 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.pct.toFixed(0)}%</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", gap: 1 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ width: `${s.pct}%`, background: s.color, minWidth: s.pct > 0 ? 2 : 0 }} />
            ))}
          </div>
          {/* Clearly styled bet buttons */}
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
                  transition: "opacity 0.12s", letterSpacing: "0.01em",
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
        /* Multi-outcome: rows with a visible Bet chip */
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
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: "auto" }}>
        <span>{isUpcoming ? "Upcoming" : `Vol Nu ${totalPool.toLocaleString()}`}</span>
        <span>{isUpcoming ? `Opens ${countdown}` : countdown}</span>
      </div>
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────

interface ActiveBet { marketId: string; outcomeId: string; }

export function PwaFeedPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const bp = useBreakpoint();

  useEffect(() => {
    getMarkets()
      .then((d) => setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming")))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    // Optimistically update local state so percentages change immediately
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

    setActiveBet(null);

    const market = markets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        const payload = market.mechanism === 'scpm'
          ? { outcomeId: activeBet.outcomeId, maxShares: betAmt, limitPrice: 1.0 }
          : { outcomeId: activeBet.outcomeId, amount: betAmt };
        await placeBet(market.id, payload);
      }
      catch (e: any) { console.warn(e.message); }
    }

    // Refresh from server to get accurate numbers
    getMarkets()
      .then((d) => setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming")))
      .catch(console.error);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 0" }}>
      <div style={{ textAlign: "center", color: "#9ca3af" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
        <div>Loading predictions…</div>
      </div>
    </div>
  );

  if (!markets.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px", textAlign: "center", gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔮</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>No open predictions</div>
      <div style={{ fontSize: 14, color: "#9ca3af" }}>Check back soon.</div>
    </div>
  );

  const gridCols = bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  const openMarkets = markets.filter((m) => m.status === "open");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

  const grid = (items: typeof markets) => (
    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, alignItems: "stretch" }}>
      {items.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
        />
      ))}
    </div>
  );

  return (
    <div style={{ padding: bp === "mobile" ? "16px 12px 80px" : "20px 16px 60px", maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
      {openMarkets.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            🟢 Active — {openMarkets.length} open
          </div>
          {grid(openMarkets)}
        </section>
      )}
      {upcomingMarkets.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Upcoming
          </div>
          {grid(upcomingMarkets)}
        </section>
      )}

      {activeMarket && activeBet && (
        <PwaPaymentModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={handlePaymentSuccess}
          onFailure={(e) => console.error(e)}
        />
      )}
    </div>
  );
}
