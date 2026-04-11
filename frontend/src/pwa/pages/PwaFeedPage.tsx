import { useState, useEffect } from "react";
import { 
  getMarkets, 
  placeBet, 
  getRecentActivity,
  type Market, 
  type ActivityEvent 
} from "@/api/client";
import { PwaPaymentModal } from "../components/PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { PwaMarketCard } from "../components/PwaMarketCard";
import { PwaMarketGrid } from "../components/PwaMarketGrid";
import { Flame } from "lucide-react";

// ── Live Activity Ticker ──────────────────────────────────────────────────────

interface FormattedEvent {
  userName: string;
  initials: string;
  action: string;
  outcome: string;
  amount: string;
  marketTitle: string;
  type: "bet" | "win";
}

function parseActivityEvent(e: ActivityEvent): FormattedEvent {
  const amount = `Nu ${Number(e.amount).toLocaleString()}`;
  const rawUserName = e.userName || "";
  const userName = rawUserName.startsWith("@") ? rawUserName.substring(1) : rawUserName;
  const initials = rawUserName ? rawUserName.substring(0, 1).toUpperCase() : "?";
  return {
    userName,
    initials,
    action: e.type === "win" ? "won" : "just bet",
    outcome: e.outomeLabel,
    amount,
    marketTitle: e.marketTitle,
    type: e.type,
  };
}

function LiveTicker() {
  const [events, setEvents] = useState<FormattedEvent[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    getRecentActivity()
      .then((data) => {
        if (data.length > 0) {
          setEvents(data.map(parseActivityEvent));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % events.length);
        setVisible(true);
      }, 400);
    }, 4500);
    return () => clearInterval(cycle);
  }, [events.length]);

  if (!events.length) return null;
  const current = events[idx];

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)",
      border: "1px solid var(--glass-border)", borderRadius: 14, padding: "8px 12px",
      marginBottom: 32, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      position: "relative",
    }}>
      <style>{`
        @keyframes tickerSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: current.type === "win" ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}>
        {current.initials === "@" ? <Flame size={16} color="#fff" fill="#fff" /> : current.initials}
      </div>
      <div style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1,
        animation: visible ? "tickerSlideUp 0.4s ease-out forwards" : "none", opacity: visible ? 1 : 0,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {current.userName} <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>{current.action}</span> <span style={{ color: current.type === "win" ? "#22c55e" : "#3b82f6" }}>{current.amount}</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          on <span style={{ color: "var(--text-muted)" }}>{current.outcome}</span> · {current.marketTitle}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239, 68, 68, 0.1)", padding: "4px 8px", borderRadius: 8, flexShrink: 0, animation: "liveBadgePulse 1.6s ease-in-out infinite" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "heartbeat 1.6s ease-in-out infinite" }} />
        <span style={{ fontSize: 9, fontWeight: 900, color: "#ef4444", textTransform: "uppercase" }}>Live</span>
      </div>
    </div>
  );
}

interface ActiveBet { marketId: string; outcomeId: string; }

export function PwaFeedPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => {
        // Only show live/upcoming for feed
        setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming" || m.status === "resolving"));
      })
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

    setActiveBet(null);

    const market = markets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        await placeBet(market.id, { outcomeId: activeBet.outcomeId, amount: betAmt });
      }
      catch (e: any) { console.warn(e.message); }
    }

    getMarkets()
      .then((d) => {
        setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming" || m.status === "resolving"));
      })
      .catch(console.error);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "100px 0" }}>
      <div style={{ textAlign: "center", color: "var(--text-subtle)" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "bounce 2s infinite" }}>🔮</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Syncing predictions…</div>
      </div>
    </div>
  );

  if (!markets.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 32px", textAlign: "center", gap: 16 }}>
      <div className="mesh-bg" />
      <div style={{ fontSize: 64 }}>🔮</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", fontFamily: "var(--font-display)" }}>No open predictions</div>
      <div style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 300 }}>The oracle is quiet. Check back later for new markets.</div>
    </div>
  );

  const openMarkets = markets.filter((m) => m.status === "open");
  const resolvingMarkets = markets.filter((m) => m.status === "resolving");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

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
    <div style={{ padding: "32px 16px 100px", maxWidth: 1200, margin: "0 auto", position: "relative" }}>
      <style>{`
        @keyframes heartbeat {
          0%   { transform: scale(1);    opacity: 1; }
          14%  { transform: scale(1.5);  opacity: 1; }
          28%  { transform: scale(1);    opacity: 0.8; }
          42%  { transform: scale(1.35); opacity: 1; }
          70%  { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes liveBadgePulse {
          0%, 70%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          14%            { box-shadow: 0 0 0 4px rgba(239,68,68,0.25); }
          42%            { box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
        }
      `}</style>
      <div className="mesh-bg" />

      <LiveTicker />

      {openMarkets.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontSize: 10, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "heartbeat 1.6s ease-in-out infinite" }} />
              Live
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", margin: 0, fontFamily: "var(--font-display)" }}>Active Markets</h2>
          </div>
          {renderGrid(openMarkets)}
        </section>
      )}
      
      {resolvingMarkets.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: 10, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}>Wait</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", margin: 0, fontFamily: "var(--font-display)" }}>Resolving</h2>
          </div>
          {renderGrid(resolvingMarkets)}
        </section>
      )}

      {upcomingMarkets.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(100, 116, 139, 0.15)", color: "var(--text-subtle)", fontSize: 10, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}>Soon</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", margin: 0, fontFamily: "var(--font-display)" }}>Upcoming</h2>
          </div>
          {renderGrid(upcomingMarkets)}
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
