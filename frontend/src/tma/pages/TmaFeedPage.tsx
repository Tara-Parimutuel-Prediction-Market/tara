import { FC, useState, useEffect } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, placeBet, type Market } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaPaymentModal } from "@/tma/components/TmaPaymentModal";
import { Link } from "@/tma/components/Link/Link";
import type { PaymentResponse } from "@/types/payment";

function outcomeColor(rank: number, total: number): string {
  if (rank === 0) return "#22c55e";
  if (rank === total - 1 && total > 1) return "#ef4444";
  return "#f59e0b";
}

function useCountdown(targetAt: string | null): string {
  const [label, setLabel] = useState("Open");
  useEffect(() => {
    if (!targetAt) return;
    const tick = () => {
      const ms = new Date(targetAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Expired");
        return;
      }
      const h = Math.floor(ms / 3_600_000),
        m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(
        h > 24
          ? `${Math.floor(h / 24)}d left`
          : h > 0
            ? `${h}h ${m}m left`
            : `${m}m left`,
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [targetAt]);
  return label;
}

// ── Market Card ───────────────────────────────────────────────────────────────

function MarketCard({
  market,
  onBet,
}: {
  market: Market;
  onBet: (outcomeId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const isUpcoming = market.status === "upcoming";
  const isResolving = market.status === "resolving";
  const countdown = useCountdown(
    isUpcoming ? (market.opensAt ?? null) : market.closesAt,
  );
  const totalPool = Number(market.totalPool);

  const sentiment = (() => {
    const raw = market.outcomes.map((o) => ({
      ...o,
      pct:
        totalPool > 0
          ? (Number(o.totalBetAmount) / totalPool) * 100
          : 100 / market.outcomes.length,
    }));
    const sorted = [...raw].sort((a, b) => b.pct - a.pct);
    return raw.map((o) => {
      const rank = sorted.findIndex((s) => s.id === o.id);
      return { ...o, color: outcomeColor(rank, raw.length) };
    });
  })();

  const displayOutcomes = showAll ? sentiment : sentiment.slice(0, 2);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.4,
          color: "var(--text-main)",
          fontFamily: "var(--font-display)",
          paddingRight: isUpcoming || isResolving ? 40 : 0,
        }}
      >
        {market.title}
      </div>

      {(isUpcoming || isResolving) && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: isUpcoming ? "#3b82f6" : "#f59e0b",
            color: "#fff",
            padding: "2px 8px",
            fontSize: "0.6rem",
            fontWeight: 800,
            borderRadius: 4,
          }}
        >
          {isUpcoming ? "SOON" : "WAIT"}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {isResolving ? (
          <Link
            to={`/market/${market.id}`}
            style={{ flex: 1, textDecoration: "none" }}
          >
            <div
              style={{
                padding: "10px",
                borderRadius: 12,
                background: "#fffbeb",
                border: "1px dashed #f59e0b",
                fontSize: "0.75rem",
                color: "#b45309",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              Dispute Window ▶
            </div>
          </Link>
        ) : isUpcoming ? (
          <div
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 12,
              background: "#f1f5f9",
              fontSize: "0.75rem",
              color: "#64748b",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Opens {countdown}
          </div>
        ) : (
          displayOutcomes.map((s) => (
            <button
              key={s.id}
              onClick={() => onBet(s.id)}
              style={{
                flex: showAll ? "1 0 45%" : 1,
                padding: "10px 4px",
                borderRadius: 12,
                background: `${s.color}15`,
                border: `1px solid ${s.color}25`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{ fontSize: "1rem", fontWeight: 900, color: s.color }}
              >
                {s.pct.toFixed(0)}%
              </div>
            </button>
          ))
        )}
      </div>

      {market.outcomes.length > 2 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAll(!showAll);
          }}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "1px solid var(--glass-border)",
            padding: "8px 12px",
            borderRadius: 12,
            fontSize: "0.75rem",
            color: "var(--text-main)",
            fontWeight: 800,
            cursor: "pointer",
            textAlign: "center",
            width: "100%",
            marginTop: 8,
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          {showAll ? "Show Less" : `View ${market.outcomes.length - 2} more...`}
        </button>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 10,
          color: "var(--text-subtle)",
          fontWeight: 700,
          paddingTop: 8,
          borderTop: "1px solid var(--glass-border)",
        }}
      >
        <div style={{ color: "#22c55e" }}>
          Nu {totalPool.toLocaleString()} Pool
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {!isUpcoming && !isResolving ? countdown : "Closed"}
        </div>
      </div>
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────

interface ActiveBet {
  marketId: string;
  outcomeId: string;
}

export const TmaFeedPage: FC = () => {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getMarkets()
      .then((d) => {
        setMarkets(
          d.filter(
            (m) =>
              m.status === "open" ||
              m.status === "resolving" ||
              m.status === "upcoming",
          ),
        );
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

    const bet = activeBet;
    setActiveBet(null);

    const market = markets.find((m) => m.id === bet.marketId);
    if (market && user) {
      try {
        await placeBet(market.id, { outcomeId: bet.outcomeId, amount: betAmt });
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
              m.status === "resolving" ||
              m.status === "upcoming",
          ),
        );
      })
      .catch(console.error);
  };

  if (loading)
    return (
      <Page>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "60vh",
          }}
        >
          <Spinner size="l" />
        </div>
      </Page>
    );

  if (!markets.length)
    return (
      <Page>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            gap: 16,
            textAlign: "center",
            padding: "0 32px",
          }}
        >
          <div style={{ fontSize: 48 }}>🔮</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "var(--text-main)",
              fontFamily: "var(--font-display)",
            }}
          >
            No open predictions
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Check back later for new markets.
          </div>
        </div>
      </Page>
    );

  const openMarkets = markets.filter((m) => m.status === "open");
  const resolvingMarkets = markets.filter((m) => m.status === "resolving");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const activeMarket = activeBet
    ? markets.find((m) => m.id === activeBet.marketId)
    : null;

  const filterByQuery = (list: Market[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q),
    );
  };

  const filteredOpen = filterByQuery(openMarkets);
  const filteredResolving = filterByQuery(resolvingMarkets);
  const filteredUpcoming = filterByQuery(upcomingMarkets);
  const hasResults =
    filteredOpen.length + filteredResolving.length + filteredUpcoming.length >
    0;

  return (
    <Page>
      <div
        style={{
          padding: "20px 14px 100px",
          background: "transparent",
          minHeight: "100vh",
          position: "relative",
        }}
      >
        <div className="mesh-bg" />

        {/* ── Search bar ── */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <svg
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-subtle)",
              pointerEvents: "none",
            }}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search predictions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 36px 10px 36px",
              borderRadius: 12,
              border: "1px solid var(--glass-border)",
              background: "var(--glass-bg)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              fontSize: 14,
              color: "var(--text-main)",
              outline: "none",
              fontFamily: "var(--font-primary)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-subtle)",
                fontSize: 16,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* No results */}
        {!hasResults && searchQuery.trim() && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 0",
              gap: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40 }}>🔍</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-main)",
              }}
            >
              No markets found
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Try a different search term.
            </div>
          </div>
        )}

        {filteredResolving.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingLeft: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#f59e0b",
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--text-main)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                WAITING
              </div>
            </div>
            {filteredResolving.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onBet={(outcomeId) =>
                  setActiveBet({ marketId: market.id, outcomeId })
                }
              />
            ))}
          </div>
        )}

        {filteredOpen.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingLeft: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22c55e",
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--text-main)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                LIVE
              </div>
            </div>
            {filteredOpen.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onBet={(outcomeId) =>
                  setActiveBet({ marketId: market.id, outcomeId })
                }
              />
            ))}
          </div>
        )}

        {filteredUpcoming.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingLeft: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#94a3b8",
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "var(--text-main)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                SOON
              </div>
            </div>
            {filteredUpcoming.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onBet={(outcomeId) =>
                  setActiveBet({ marketId: market.id, outcomeId })
                }
              />
            ))}
          </div>
        )}
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
