import { FC, useState, useEffect } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, getMyBets, getRecentActivity, type Market, type ActivityEvent } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaBetModal } from "@/tma/components/TmaBetModal";
import { Link } from "@/tma/components/Link/Link";
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
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "var(--bg-card)",
      border: "1px solid var(--glass-border)",
      borderRadius: 14,
      padding: "8px 12px",
      marginBottom: 16,
      overflow: "hidden",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      position: "relative",
    }}>
      <style>{`
        @keyframes tickerSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Avatar / Initial */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: current.type === "win" 
          ? "linear-gradient(135deg, #22c55e, #16a34a)" 
          : "linear-gradient(135deg, #3b82f6, #2563eb)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}>
        {current.initials === "@" ? (
          <Flame size={16} color="#fff" fill="#fff" />
        ) : (
          current.initials
        )}
      </div>

      <div style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        animation: visible ? "tickerSlideUp 0.4s ease-out forwards" : "none",
        opacity: visible ? 1 : 0,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--text-main)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {current.userName} <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>{current.action}</span>{" "}
          <span style={{ color: current.type === "win" ? "#22c55e" : "#3b82f6" }}>{current.amount}</span>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-subtle)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          on <span style={{ color: "var(--text-muted)" }}>{current.outcome}</span> · {current.marketTitle}
        </div>
      </div>

      {/* Live Indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "rgba(239, 68, 68, 0.1)",
        padding: "4px 8px",
        borderRadius: 8,
        flexShrink: 0,
      }}>
        <div style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#ef4444",
          animation: "livePulse 1.5s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 9, fontWeight: 900, color: "#ef4444", textTransform: "uppercase" }}>Live</span>
      </div>
    </div>
  );
}

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
  telegramId,
}: {
  market: Market;
  onBet: (outcomeId: string) => void;
  hasBet: boolean;
  telegramId?: string | number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const isUpcoming = market.status === "upcoming";
  const isResolving = market.status === "resolving";
  const countdown = useCountdown(
    isUpcoming ? (market.opensAt ?? null) : market.closesAt,
  );
  const totalPool = Number(market.totalPool);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const refLink = `https://t.me/OroPredictBot/app?startapp=ref_${telegramId || ""}`;
    // Pick the top outcome the user (or crowd) is backing
    const topOutcome = [...market.outcomes].sort(
      (a, b) => (b.lmsrProbability ?? 0) - (a.lmsrProbability ?? 0),
    )[0];
    const outcomeLabel = topOutcome?.label ?? "an outcome";
    const text = `🔥 I just called it — betting on *${outcomeLabel}* in:\n"${market.title}"\n\nThink you can predict better? Prove it 👇\n${refLink}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

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
        border: "none",
        borderRadius: 20,
        padding: "18px 16px",
        marginBottom: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -3px -3px 10px rgba(255,255,255,0.04)",
      }}
    >
      <style>{`@keyframes shimmer-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
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
                  borderRadius: 16,
                  background: "var(--bg-card)",
                  border: "none",
                  cursor: "pointer",
                  overflow: "hidden",
                  boxShadow: `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`,
                  transition: "box-shadow 0.15s ease, transform 0.12s ease",
                  display: "block",
                  textAlign: "left",
                  position: "relative",
                }}
                onMouseDown={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.boxShadow = `inset 3px 3px 8px rgba(0,0,0,0.3), inset -1px -1px 4px rgba(255,255,255,0.03), inset 0 0 0 1px ${s.color}50`;
                  el.style.transform = "scale(0.985)";
                }}
                onMouseUp={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.boxShadow = `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`;
                  el.style.transform = "scale(1)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.boxShadow = `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`;
                  el.style.transform = "scale(1)";
                }}
              >
                {/* Pool fill — solid left edge fading right, width = probability */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${s.color}55 0%, ${s.color}28 60%, transparent 100%)`,
                    borderRadius: "16px 0 0 16px",
                    transition: "width 1s ease",
                    pointerEvents: "none",
                  }}
                />
                {/* Shimmer sweep */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  borderRadius: 16,
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: "40%",
                    background: `linear-gradient(90deg, transparent, ${s.color}18, transparent)`,
                    animation: "shimmer-slide 2.4s ease-in-out infinite",
                  }} />
                </div>
                {/* Button content */}
                <div
                  style={{
                    position: "relative",
                    padding: "13px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  {/* Left: label + reputation signal */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: "0.9rem",
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
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Experts {Math.round(s.reputationSignal * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Right: neumorphic percentage badge */}
                  <div
                    style={{
                      background: `${s.color}22`,
                      border: `1.5px solid ${s.color}50`,
                      boxShadow: `2px 2px 6px rgba(0,0,0,0.2), -1px -1px 4px rgba(255,255,255,0.04)`,
                      color: s.color,
                      fontSize: "1rem",
                      fontWeight: 900,
                      padding: "4px 14px",
                      borderRadius: 99,
                      letterSpacing: "-0.01em",
                      flexShrink: 0,
                    }}
                  >
                    {s.pct.toFixed(0)}%
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {!isUpcoming && !isResolving ? countdown : "Closed"}
          </div>
          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "1px solid var(--glass-border)",
              borderRadius: 8,
              padding: "3px 8px",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-subtle)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
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
                telegramId={user?.telegramId}
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
            
            {/* ── Live activity ticker (Redesigned & Relocated) ── */}
            <LiveTicker />

            {filteredOpen.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                hasBet={bettedMarketIds.has(market.id)}
                telegramId={user?.telegramId}
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
                telegramId={user?.telegramId}
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
