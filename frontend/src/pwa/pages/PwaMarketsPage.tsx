import { useState, useEffect } from "react";
import {
  getMarkets,
  placeBet,
  getRecentActivity,
  type Market,
  type ActivityEvent,
} from "@/api/client";
import { PwaPaymentModal } from "../components/PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { PwaMarketCard } from "../components/PwaMarketCard";
import { PwaMarketGrid } from "../components/PwaMarketGrid";
import { useFilter } from "@/contexts/FilterContext";
import { Flame } from "lucide-react";

// ── Live Activity Ticker ──────────────────────────────────────────────────────

interface FormattedEvent {
  userName: string;
  action: string;
  outcome: string;
  amount: string;
  type: "bet" | "win";
}

function parseEvent(e: ActivityEvent): FormattedEvent {
  const rawName = e.userName || "";
  return {
    userName: rawName.startsWith("@") ? rawName.substring(1) : rawName,
    action: e.type === "win" ? "won" : "just bet",
    outcome: e.outomeLabel,
    amount: `Nu ${Number(e.amount).toLocaleString()}`,
    type: e.type,
  };
}

function LiveTicker() {
  const [events, setEvents] = useState<FormattedEvent[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    getRecentActivity()
      .then((data) => { if (data.length > 0) setEvents(data.map(parseEvent)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx((i) => (i + 1) % events.length); setVisible(true); }, 400);
    }, 4500);
    return () => clearInterval(cycle);
  }, [events.length]);

  if (!events.length) return null;
  const cur = events[idx];

  return (
    <>
      <div style={{ width: 1, height: 16, background: "var(--glass-border)", flexShrink: 0, margin: "0 4px" }} />
      <div style={{
        flex: 1, minWidth: 0,
        animation: visible ? "tickerSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
        opacity: visible ? 1 : 0,
        display: "flex", alignItems: "center", gap: 6, overflow: "hidden",
      }}>
        <Flame size={14} style={{ flexShrink: 0, color: "var(--color-warning)", fill: "#f59e0b40" }} />
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-main)", whiteSpace: "nowrap", flexShrink: 0 }}>{cur.userName}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{cur.action}</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 900, color: cur.type === "win" ? "var(--color-success)" : "var(--color-primary)", whiteSpace: "nowrap", flexShrink: 0 }}>{cur.amount}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>· {cur.outcome}</span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function PwaMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<{
    marketId: string;
    outcomeId: string;
  } | null>(null);
  const { searchQuery, setAvailableCategories, selectedCategory } = useFilter();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the global search query → 400 ms before hitting the server
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch from server whenever the committed search term changes
  useEffect(() => {
    setLoading(true);
    getMarkets(debouncedSearch.trim() || undefined)
      .then((data) => {
        const active = data.filter((m) => m.status === "open" || m.status === "upcoming");
        setMarkets(active);
        const cats = ["All", ...Array.from(new Set(active.map((m) => m.category).filter(Boolean))) as string[]];
        setAvailableCategories(cats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    const prevMarkets = markets;

    setMarkets((prev) =>
      prev.map((m) => {
        if (m.id !== activeBet.marketId) return m;
        return {
          ...m,
          totalPool: String(Number(m.totalPool) + betAmt),
          outcomes: m.outcomes.map((o) =>
            o.id === activeBet.outcomeId
              ? { ...o, totalBetAmount: String(Number(o.totalBetAmount) + betAmt) }
              : o,
          ),
        };
      }),
    );

    setActiveBet(null);
    const market = prevMarkets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        await placeBet(market.id, { outcomeId: activeBet.outcomeId, amount: betAmt });
      } catch (e: any) {
        setMarkets(prevMarkets);
        console.warn("Bet placement failed, rolled back:", e.message);
      }
    }
    getMarkets(debouncedSearch.trim() || undefined).then(setMarkets).catch(console.error);
  };

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "100px 0" }}>
        <div style={{ textAlign: "center", color: "var(--text-subtle)" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "bounce 2s infinite" }}>🔮</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Syncing predictions…</div>
        </div>
      </div>
    );

  const byCat = (m: Market) =>
    selectedCategory === "All" ||
    (m.category ?? "").toLowerCase() === selectedCategory.toLowerCase();

  const openMarkets = markets.filter((m) => m.status === "open" && byCat(m));
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming" && byCat(m));
  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;
  const hasResults = markets.length > 0;

  const renderGrid = (items: Market[]) => (
    <PwaMarketGrid>
      {items.map((market) => (
        <PwaMarketCard
          key={market.id}
          market={market}
          onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
        />
      ))}
    </PwaMarketGrid>
  );

  return (
    <div style={{ padding: "0 0 100px", maxWidth: 1240, margin: "0 auto", position: "relative" }}>
      <style>{`
        @keyframes livePing {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes liveTextGlow {
          0%, 100% { opacity: 1; text-shadow: 0 0 6px rgba(34,197,94,0.6); }
          50%       { opacity: 0.7; text-shadow: 0 0 14px rgba(34,197,94,1); }
        }
        @keyframes tickerSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 767px) { .section-title { display: none; } }
      `}</style>
      <div className="mesh-bg" />

      <div style={{ padding: "var(--space-xl) var(--space-md) var(--space-lg)" }}>

        {/* No results */}
        {!hasResults && debouncedSearch.trim() && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-subtle)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>No markets found</div>
            <div style={{ fontSize: "1rem", marginTop: 8, fontWeight: 500 }}>Try a different search term.</div>
          </div>
        )}

        {openMarkets.length > 0 && (
          <section style={{ marginBottom: "var(--space-xl)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-md)" }}>
              {/* Live badge with ping dot */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: "var(--radius-sm)",
                background: "rgba(34, 197, 94, 0.1)", color: "var(--color-success)",
                fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.08em",
                textTransform: "uppercase", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.1)",
                flexShrink: 0,
              }}>
                <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-success)", animation: "livePing 1.5s ease-out infinite" }} />
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-success)" }} />
                </div>
                <span style={{ animation: "liveTextGlow 1.8s ease-in-out infinite" }}>Live</span>
              </div>
              <h2 className="section-title" style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-main)", margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>Active Markets</h2>
              <LiveTicker />
            </div>
            {renderGrid(openMarkets)}
          </section>
        )}

        {upcomingMarkets.length > 0 && (
          <section style={{ marginBottom: "var(--space-xl)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-md)" }}>
              <div style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "rgba(59, 130, 246, 0.1)", color: "var(--color-info)", fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Soon</div>
              <h2 className="section-title" style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--text-main)", margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>Coming Up</h2>
            </div>
            {renderGrid(upcomingMarkets)}
          </section>
        )}

      </div>

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
