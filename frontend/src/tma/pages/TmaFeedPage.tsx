import { FC, useState, useEffect } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, getMyBets, type Market } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaBetModal } from "@/tma/components/TmaBetModal";
import { Link } from "@/tma/components/Link/Link";

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
  hasBet,
}: {
  market: Market;
  onBet: (outcomeId: string) => void;
  /** True when the current user already has a position in this market */
  hasBet: boolean;
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
      // After betting: prefer intelligence-weighted prob, then LMSR.
      // Before betting: use LMSR (avoids 0%/100% on single-bettor markets).
      // Raw parimutuel ratio is only a last resort when no LMSR is stored.
      pct:
        hasBet && o.intelligenceProb != null && o.intelligenceProb > 0
          ? o.intelligenceProb * 100
          : o.lmsrProbability != null && o.lmsrProbability > 0
            ? o.lmsrProbability * 100
            : totalPool > 0
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

      {/* ── Outcome buttons ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 4,
        }}
      >
        {isResolving ? (
          <Link to={`/market/${market.id}`} style={{ textDecoration: "none" }}>
            <div
              style={{
                padding: "13px 16px",
                borderRadius: 14,
                background: "#fffbeb",
                border: "1.5px dashed #f59e0b",
                fontSize: "0.8rem",
                color: "#b45309",
                fontWeight: 800,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#b45309"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Dispute Window Open — Tap to View
            </div>
          </Link>
        ) : isUpcoming ? (
          <div
            style={{
              padding: "13px 16px",
              borderRadius: 14,
              background: "rgba(59,130,246,0.06)",
              border: "1.5px solid rgba(59,130,246,0.2)",
              fontSize: "0.8rem",
              color: "#3b82f6",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Opens {countdown}
          </div>
        ) : (
          displayOutcomes.map((s) => {
            const barWidth = Math.max(4, Math.min(100, s.pct));
            return (
              <button
                key={s.id}
                onClick={() => onBet(s.id)}
                style={{
                  width: "100%",
                  padding: "0",
                  borderRadius: 14,
                  background: "var(--bg-main)",
                  border: `1.5px solid ${s.color}40`,
                  cursor: "pointer",
                  overflow: "hidden",
                  boxShadow: "none",
                  transition: "transform 0.12s ease",
                  display: "block",
                  textAlign: "left",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1.01)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1)";
                }}
                onMouseDown={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(0.98)";
                }}
                onMouseUp={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "scale(1.01)";
                }}
              >
                {/* Progress bar fill behind content */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${barWidth}%`,
                    background: `${s.color}12`,
                    borderRadius: 14,
                    transition: "width 0.8s ease",
                    pointerEvents: "none",
                  }}
                />
                {/* Button content */}
                <div
                  style={{
                    position: "relative",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  {/* Left: label + reputation signal */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 800,
                        color: "var(--text-main)",
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.label}
                    </span>
                    {s.reputationSignal != null && hasBet && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          color: "#f59e0b",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="#f59e0b"
                          stroke="none"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Experts {Math.round(s.reputationSignal * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Right: percentage + predict pill */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 900,
                        color: s.color,
                        letterSpacing: "-0.02em",
                        minWidth: 42,
                        textAlign: "right",
                      }}
                    >
                      {s.pct.toFixed(0)}%
                    </span>
                    <span
                      style={{
                        background: s.color,
                        color: "#fff",
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        padding: "5px 10px",
                        borderRadius: 99,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        boxShadow: `0 2px 6px ${s.color}55`,
                      }}
                    >
                      Predict
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {market.outcomes.length > 2 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAll(!showAll);
          }}
          style={{
            background: "transparent",
            border: "1.5px solid var(--glass-border)",
            padding: "9px 12px",
            borderRadius: 12,
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "center",
            width: "100%",
          }}
        >
          {showAll
            ? "Show Less ▲"
            : `+${market.outcomes.length - 2} more outcomes`}
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
  // Set of marketIds where the current user already has a position
  const [bettedMarketIds, setBettedMarketIds] = useState<Set<string>>(
    new Set(),
  );

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

    // Fetch the user's active positions to know which markets they've bet on
    if (user) {
      getMyBets("pending")
        .then((bets) => {
          setBettedMarketIds(new Set(bets.map((b) => b.marketId)));
        })
        .catch(() => {});
    }
  }, []);

  const handlePaymentSuccess = async () => {
    if (!activeBet) return;

    const bet = activeBet;
    setActiveBet(null);

    // Mark this market as bet so the signal reveals immediately on the feed
    setBettedMarketIds((prev) => new Set([...prev, bet.marketId]));

    // Refresh markets to get updated pool/odds
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

  const filteredOpen = filterByQuery(openMarkets).sort(
    (a, b) => Number(b.totalPool) - Number(a.totalPool),
  );
  const filteredResolving = filterByQuery(resolvingMarkets);
  const filteredUpcoming = filterByQuery(upcomingMarkets);

  const HOT_THRESHOLD = 1000;
  const trendingMarkets = openMarkets
    .filter((m) => Number(m.totalPool) >= HOT_THRESHOLD)
    .sort((a, b) => Number(b.totalPool) - Number(a.totalPool))
    .slice(0, 5);
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

        {/* ── Trending strip ── */}
        {trendingMarkets.length > 0 && !searchQuery.trim() && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "var(--text-main)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="#ff6f01ff"
                stroke="none"
              >
                <path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z" />
              </svg>
              Trending
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                scrollbarWidth: "none",
              }}
            >
              {trendingMarkets.map((m) => {
                const prob = (o: (typeof m.outcomes)[0]) =>
                  o.intelligenceProb != null && o.intelligenceProb > 0
                    ? o.intelligenceProb
                    : o.lmsrProbability != null && o.lmsrProbability > 0
                      ? o.lmsrProbability
                      : Number(m.totalPool) > 0
                        ? Number(o.totalBetAmount) / Number(m.totalPool)
                        : 0;
                const top = m.outcomes.reduce(
                  (a, b) => (prob(b) > prob(a) ? b : a),
                  m.outcomes[0],
                );
                const topPct = Math.round(prob(top) * 100);
                return (
                  <button
                    key={m.id}
                    onClick={() =>
                      setActiveBet({ marketId: m.id, outcomeId: top.id })
                    }
                    style={{
                      flexShrink: 0,
                      width: 140,
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "var(--bg-card)",
                      border: "1px solid var(--glass-border)",
                      textAlign: "left",
                      cursor: "pointer",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-main)",
                        lineHeight: 1.3,
                        marginBottom: 6,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {m.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#22c55e",
                        }}
                      >
                        {top.label} {topPct}%
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: "var(--text-subtle)",
                          fontWeight: 600,
                        }}
                      >
                        Nu {Number(m.totalPool).toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                hasBet={bettedMarketIds.has(market.id)}
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
                hasBet={bettedMarketIds.has(market.id)}
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
                hasBet={bettedMarketIds.has(market.id)}
                onBet={(outcomeId) =>
                  setActiveBet({ marketId: market.id, outcomeId })
                }
              />
            ))}
          </div>
        )}
      </div>

      {activeMarket && activeBet && (
        <TmaBetModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={handlePaymentSuccess}
          onFailure={(e: string) => console.error(e)}
        />
      )}
    </Page>
  );
};
