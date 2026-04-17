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
import { Flame } from "lucide-react";
import { useFilter } from "@/contexts/FilterContext";

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
  const userName = rawUserName.startsWith("@")
    ? rawUserName.substring(1)
    : rawUserName;
  const initials = rawUserName
    ? rawUserName.substring(0, 1).toUpperCase()
    : "?";
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
    <>
      <style>{`
        @keyframes tickerSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          width: 1,
          height: 16,
          background: "var(--glass-border)",
          flexShrink: 0,
          margin: "0 8px",
        }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          animation: visible ? "tickerSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : "none",
          opacity: visible ? 1 : 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflow: "hidden",
        }}
      >
        <Flame
          size={14}
          style={{ flexShrink: 0, color: "var(--color-warning)", fill: "#f59e0b40" }}
        />
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 800,
            color: "var(--text-main)",
            whiteSpace: "nowrap",
            flexShrink: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {current.userName}
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {current.action}
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 900,
            color: current.type === "win" ? "var(--color-success)" : "var(--color-primary)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {current.amount}
        </span>
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-subtle)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: 600,
          }}
        >
          · {current.outcome}
        </span>
      </div>
    </>
  );
}

interface ActiveBet {
  marketId: string;
  outcomeId: string;
}

export function PwaFeedPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const {
    searchQuery,
    selectedCategory,
    setAvailableCategories,
  } = useFilter();

  useEffect(() => {
    getMarkets()
      .then((d) => {
        // Only show live/upcoming for feed
        const active = d.filter(
          (m) =>
            m.status === "open" ||
            m.status === "upcoming" ||
            m.status === "resolving",
        );
        setMarkets(active);

        // Update global categories
        const cats = ["All", ...Array.from(new Set(active.map((m) => m.category).filter(Boolean))) as string[]];
        setAvailableCategories(cats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    setMarkets((prev) =>
      prev.map((m) => {
        if (m.id !== activeBet.marketId) return m;
        return {
          ...m,
          totalPool: String(Number(m.totalPool) + betAmt),
          outcomes: m.outcomes.map((o) =>
            o.id === activeBet.outcomeId
              ? {
                  ...o,
                  totalBetAmount: String(Number(o.totalBetAmount) + betAmt),
                }
              : o,
          ),
        };
      }),
    );

    setActiveBet(null);

    const market = markets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        await placeBet(market.id, {
          outcomeId: activeBet.outcomeId,
          amount: betAmt,
        });
      } catch (e: any) {
        console.warn(e.message);
      }
    }

    getMarkets()
      .then((d) => {
        setMarkets(
          d.filter(
            (m) =>
              m.status === "open" ||
              m.status === "upcoming" ||
              m.status === "resolving",
          ),
        );
      })
      .catch(console.error);
  };

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "100px 0",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-subtle)" }}>
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
              animation: "bounce 2s infinite",
            }}
          >
            🔮
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.01em" }}>
            Reading the Oracles…
          </div>
        </div>
      </div>
    );

  if (!markets.length)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 32px",
          textAlign: "center",
          gap: 16,
        }}
      >
        <div className="mesh-bg" />
        <div style={{ fontSize: 64, filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.2))" }}>🔮</div>
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 900,
            color: "var(--text-main)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
          }}
        >
          The Oracles are Quiet
        </div>
        <div
          style={{ fontSize: "1rem", color: "var(--text-muted)", maxWidth: 350, lineHeight: 1.6, fontWeight: 500 }}
        >
          Check back soon for new prophecy opportunities and community predictions.
        </div>
      </div>
    );

  const filteredMarkets = markets.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" ||
      (m.category && m.category.toLowerCase() === selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const openMarkets = filteredMarkets.filter((m) => m.status === "open");
  const resolvingMarkets = filteredMarkets.filter((m) => m.status === "resolving");
  const upcomingMarkets = filteredMarkets.filter((m) => m.status === "upcoming");
  const activeMarket = activeBet
    ? markets.find((m) => m.id === activeBet.marketId)
    : null;

  const renderGrid = (items: Market[]) => (
    <PwaMarketGrid>
      {items.map((market) => (
        <PwaMarketCard
          key={market.id}
          market={market}
          onBet={(outcomeId) =>
            setActiveBet({ marketId: market.id, outcomeId })
          }
        />
      ))}
    </PwaMarketGrid>
  );

  return (
    <div
      style={{
        padding: "var(--space-xl) var(--space-md) 100px",
        maxWidth: 1240,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes heartbeat {
          0%   { transform: scale(1);    opacity: 1; }
          14%  { transform: scale(1.3);  opacity: 1; }
          28%  { transform: scale(1);    opacity: 0.9; }
          42%  { transform: scale(1.2);  opacity: 1; }
          70%  { transform: scale(1);    opacity: 0.8; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
      <div className="mesh-bg" />

      {openMarkets.length > 0 && (
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: "var(--space-md)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(34, 197, 94, 0.1)",
                color: "var(--color-success)",
                fontSize: "0.65rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.1)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-success)",
                  animation: "heartbeat 2.4s ease-in-out infinite",
                }}
              />
              Live
            </div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 900,
                color: "var(--text-main)",
                margin: 0,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.03em",
              }}
            >
              Featured Feed
            </h2>
            <LiveTicker />
          </div>
          {renderGrid(openMarkets)}
        </section>
      )}

      {resolvingMarkets.length > 0 && (
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: "var(--space-md)",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(245, 158, 11, 0.1)",
                color: "var(--color-warning)",
                fontSize: "0.65rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Resolving
            </div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 900,
                color: "var(--text-main)",
                margin: 0,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.03em",
              }}
            >
              Oracle Verification
            </h2>
          </div>
          {renderGrid(resolvingMarkets)}
        </section>
      )}

      {upcomingMarkets.length > 0 && (
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: "var(--space-md)",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(59, 130, 246, 0.1)",
                color: "var(--color-info)",
                fontSize: "0.65rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              SOON
            </div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 900,
                color: "var(--text-main)",
                margin: 0,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.03em",
              }}
            >
              Coming Up
            </h2>
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
