import { FC, useEffect, useState } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  getLeaderboard,
  getMyResults,
  getMe,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type Bet,
  type AuthUser,
} from "@/api/client";
import { BetShareCard } from "@/components/BetShareCard";
import { BadgeGrid } from "@/tma/components/BadgeGrid";
import {
  Trophy,
  Flame,
  TrendingUp,
  Share2,
  Crosshair,
  Sprout,
  Medal,
  X,
} from "lucide-react";

// ── Tier helpers ──────────────────────────────────────────────────────────────

function tierLabel(tier: string) {
  return tier === "expert"
    ? "Legend"
    : tier === "reliable"
      ? "Hot Hand"
      : tier === "regular"
        ? "Sharpshooter"
        : "Rookie";
}

function tierColor(tier: string) {
  return tier === "expert"
    ? "#f59e0b"
    : tier === "reliable"
      ? "#22c55e"
      : tier === "regular"
        ? "#3b82f6"
        : "#94a3b8";
}

function tierIcon(tier: string, size = 12) {
  if (tier === "expert") return <Trophy size={size} color="#f59e0b" />;
  if (tier === "reliable") return <Flame size={size} color="#22c55e" />;
  if (tier === "regular") return <Crosshair size={size} color="#3b82f6" />;
  return <Sprout size={size} color="#94a3b8" />;
}

function rankMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function percentileLabel(rank: number, total: number) {
  if (total === 0) return null;
  const pct = Math.round((rank / total) * 100);
  if (pct <= 5) return { text: `Top ${pct}% of predictors`, color: "#f59e0b" };
  if (pct <= 20) return { text: `Top ${pct}% of predictors`, color: "#22c55e" };
  if (pct <= 50) return { text: `Top ${pct}% of predictors`, color: "#3b82f6" };
  return { text: `Top ${pct}% of predictors`, color: "#94a3b8" };
}

// ── Leaderboard row ───────────────────────────────────────────────────────────

function LeaderRow({ entry }: { entry: LeaderboardEntry }) {
  const medal = rankMedal(entry.rank);
  const color = tierColor(entry.reputationTier);
  const displayName = entry.username
    ? `@${entry.username}`
    : entry.firstName + (entry.lastName ? ` ${entry.lastName}` : "");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: entry.isMe
          ? `linear-gradient(135deg, ${color}18, ${color}08)`
          : "transparent",
        borderRadius: entry.isMe ? 14 : 0,
        border: entry.isMe ? `1px solid ${color}33` : "none",
        position: "relative",
      }}
    >
      {/* Rank */}
      <div
        style={{
          width: 32,
          textAlign: "center",
          flexShrink: 0,
          fontSize: medal ? 18 : 13,
          fontWeight: 900,
          color: entry.rank <= 3 ? color : "var(--text-subtle)",
        }}
      >
        {medal ?? `#${entry.rank}`}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          border: entry.isMe
            ? `2px solid ${color}`
            : "2px solid var(--glass-border)",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 800,
          color: "var(--text-muted)",
        }}
      >
        {entry.photoUrl ? (
          <img
            src={entry.photoUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          (entry.firstName?.[0] ?? "?").toUpperCase()
        )}
      </div>

      {/* Name + tier */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: entry.isMe ? 800 : 600,
            color: "var(--text-main)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
          {entry.isMe && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 700,
                color,
                background: `${color}22`,
                padding: "1px 6px",
                borderRadius: 99,
              }}
            >
              you
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 2,
          }}
        >
          {tierIcon(entry.reputationTier)}
          <span
            style={{
              fontSize: 10,
              color: "var(--text-subtle)",
              fontWeight: 600,
            }}
          >
            {tierLabel(entry.reputationTier)}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>
            {entry.totalPredictions} picks
          </span>
        </div>
      </div>

      {/* Win rate */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color:
              entry.winRate >= 65
                ? "#22c55e"
                : entry.winRate >= 50
                  ? "var(--text-main)"
                  : "#f59e0b",
            letterSpacing: "-0.02em",
          }}
        >
          {entry.winRate}%
        </div>
        <div
          style={{
            fontSize: 9,
            color: "var(--text-subtle)",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          win rate
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const TmaLeaderboardPage: FC = () => {
  const { user: authUser } = useAuth();
  const [lb, setLb] = useState<LeaderboardResponse | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "my-record">(
    "leaderboard",
  );
  const [visibleCount, setVisibleCount] = useState(5);
  const [visibleBets, setVisibleBets] = useState(5);

  useEffect(() => {
    Promise.all([
      getLeaderboard().catch(() => null),
      getMyResults().catch(() => []),
      getMe().catch(() => null),
    ])
      .then(([lbData, myBets, myProfile]) => {
        setLb(lbData);
        setBets(myBets as Bet[]);
        setMe(myProfile);
      })
      .finally(() => setLoading(false));
  }, []);

  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const validBets = bets.filter(
    (b) => b.status !== "refunded" && b.status !== "pending",
  );
  const winRate =
    validBets.length > 0
      ? Math.round((won.length / validBets.length) * 100)
      : 0;

  const myEntry = lb?.board.find((r) => r.isMe);
  const rankToShow = lb?.myRank ?? null;
  const percentile =
    rankToShow && lb?.totalRanked
      ? percentileLabel(rankToShow, lb.totalRanked)
      : null;

  const userName = authUser?.username
    ? `@${authUser.username}`
    : (authUser?.firstName ?? "Predictor");

  if (loading) {
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
  }

  return (
    <Page>
      <div style={{ padding: "20px 0 100px", minHeight: "100vh" }}>
        <div className="mesh-bg" />

        {/* ── Header ── */}
        <div style={{ padding: "0 16px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "var(--text-main)",
                  margin: 0,
                  letterSpacing: "-0.02em",
                  fontFamily: "var(--font-display)",
                }}
              >
                Leaderboard
              </h1>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  margin: "4px 0 0",
                  fontWeight: 600,
                }}
              >
                {lb?.totalRanked ?? 0} ranked predictors
              </p>
            </div>

            {/* My rank badge */}
            {rankToShow && (
              <div
                style={{
                  background: "linear-gradient(135deg, #f59e0b22, #f59e0b11)",
                  border: "1px solid #f59e0b44",
                  borderRadius: 14,
                  padding: "8px 14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#f59e0b",
                    letterSpacing: "-0.02em",
                  }}
                >
                  #{rankToShow}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: "#f59e0b",
                    textTransform: "uppercase",
                  }}
                >
                  your rank
                </div>
              </div>
            )}
          </div>

          {/* Percentile banner */}
          {percentile && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 14px",
                background: `${percentile.color}15`,
                border: `1px solid ${percentile.color}30`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Medal size={14} color={percentile.color} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: percentile.color,
                }}
              >
                {percentile.text}
              </span>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 0,
            borderBottom: "1px solid var(--glass-border)",
            padding: "0 16px",
          }}
        >
          {[
            { key: "leaderboard", label: "Global" },
            { key: "my-record", label: "My Record" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === t.key
                    ? "2px solid #3b82f6"
                    : "2px solid transparent",
                color: activeTab === t.key ? "#3b82f6" : "var(--text-muted)",
                fontWeight: activeTab === t.key ? 800 : 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Global Leaderboard ── */}
        {activeTab === "leaderboard" && (
          <div style={{ padding: "12px 0" }}>
            {!lb || lb.board.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 0",
                  color: "var(--text-subtle)",
                }}
              >
                <Trophy
                  size={48}
                  strokeWidth={1.5}
                  style={{ marginBottom: 12, opacity: 0.4 }}
                />
                <p style={{ fontWeight: 600 }}>No ranked predictors yet.</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  Be the first to make predictions!
                </p>
              </div>
            ) : (
              <div>
                {lb.board.slice(0, visibleCount).map((entry, i) => (
                  <div key={entry.id}>
                    <LeaderRow entry={entry} />
                    {i < Math.min(visibleCount, lb.board.length) - 1 && (
                      <div
                        style={{
                          height: 1,
                          background: "var(--glass-border)",
                          margin: "0 16px",
                        }}
                      />
                    )}
                  </div>
                ))}

                {/* View More button */}
                {visibleCount < lb.board.length && (
                  <button
                    onClick={() =>
                      setVisibleCount((c) => Math.min(c + 10, lb.board.length))
                    }
                    style={{
                      width: "calc(100% - 32px)",
                      margin: "12px 16px 0",
                      padding: "11px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: 12,
                      color: "var(--text-muted)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    View More · {lb.board.length - visibleCount} remaining
                  </button>
                )}

                {/* If user is outside top 50, show their row at the bottom */}
                {!myEntry && rankToShow && me && (
                  <>
                    <div style={{ padding: "8px 16px", textAlign: "center" }}>
                      <span
                        style={{ fontSize: 11, color: "var(--text-subtle)" }}
                      >
                        · · ·
                      </span>
                    </div>
                    <LeaderRow
                      entry={{
                        rank: rankToShow,
                        id: me.id,
                        firstName: me.firstName,
                        lastName: me.lastName ?? null,
                        username: me.username ?? null,
                        photoUrl: me.photoUrl ?? null,
                        reputationScore: me.reputationScore ?? null,
                        reputationTier: me.reputationTier ?? "newcomer",
                        totalPredictions: me.totalPredictions ?? 0,
                        correctPredictions: me.correctPredictions ?? 0,
                        winRate,
                        isMe: true,
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: My Record ── */}
        {activeTab === "my-record" && (
          <div style={{ padding: "16px 16px 0" }}>
            {/* Stats summary */}
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 16,
                padding: "16px",
                marginBottom: 16,
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "var(--text-main)",
                  }}
                >
                  My Stats
                </span>
                <button
                  onClick={() => setShowShareModal(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Share2 size={13} /> Share my record
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {[
                  {
                    value: validBets.length,
                    label: "Picks",
                    color: "var(--text-main)",
                  },
                  { value: won.length, label: "Wins", color: "#22c55e" },
                  { value: lost.length, label: "Losses", color: "#ef4444" },
                  {
                    value: `${winRate}%`,
                    label: "Win Rate",
                    color: winRate >= 50 ? "#22c55e" : "#f59e0b",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "var(--bg-secondary)",
                      borderRadius: 10,
                      padding: "10px 6px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{ fontSize: 18, fontWeight: 900, color: s.color }}
                    >
                      {s.value}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rank progress */}
              {percentile && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    background: `${percentile.color}15`,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <TrendingUp size={14} color={percentile.color} />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: percentile.color,
                    }}
                  >
                    {percentile.text}
                  </span>
                </div>
              )}
            </div>

            {/* ── Collectibles ── */}
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                border: "1px solid var(--glass-border)",
                overflow: "visible",
              }}
            >
              <BadgeGrid
                totalPredictions={me?.totalPredictions ?? 0}
                correctPredictions={me?.correctPredictions ?? 0}
                reputationTier={me?.reputationTier ?? "newcomer"}
                reputationScore={me?.reputationScore ?? 0}
                hasPhone={!!me?.isPhoneVerified}
                hasDKBank={!!me?.dkCid}
              />
            </div>

            {/* Color-coded bet list */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-subtle)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              Recent Results
            </div>

            {bets.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "var(--text-subtle)",
                }}
              >
                <p style={{ fontWeight: 600 }}>No settled bets yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bets
                  .filter((b) => b.status !== "pending")
                  .slice(0, visibleBets)
                  .map((bet) => {
                    const isWon = bet.status === "won";
                    const isLost = bet.status === "lost";
                    const isRefunded = bet.status === "refunded";
                    const accentColor = isWon
                      ? "#22c55e"
                      : isLost
                        ? "#ef4444"
                        : "#94a3b8";
                    const bgColor = isWon
                      ? "rgba(34,197,94,0.06)"
                      : isLost
                        ? "rgba(239,68,68,0.06)"
                        : "rgba(148,163,184,0.06)";

                    // Strip "other" category — only show if meaningful
                    const category =
                      bet.market?.category &&
                      bet.market.category.toLowerCase() !== "other"
                        ? bet.market.category
                        : null;

                    return (
                      <div
                        key={bet.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 14,
                          background: bgColor,
                          borderLeft: `3px solid ${accentColor}`,
                          border: `1px solid ${accentColor}22`,
                          borderLeftWidth: 3,
                        }}
                      >
                        {/* Status icon */}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: `${accentColor}22`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            fontSize: 14,
                          }}
                        >
                          {isWon ? "✓" : isLost ? "✗" : "↩"}
                        </div>

                        {/* Market info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--text-main)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {bet.market?.title ?? "Market"}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 2,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: accentColor,
                                background: `${accentColor}18`,
                                padding: "1px 7px",
                                borderRadius: 99,
                              }}
                            >
                              {bet.outcome?.label ?? "—"}
                            </span>
                            {category && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "var(--text-subtle)",
                                  background: "var(--bg-secondary)",
                                  padding: "1px 6px",
                                  borderRadius: 99,
                                  textTransform: "uppercase",
                                }}
                              >
                                {category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Payout */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          {isWon && bet.payout ? (
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 900,
                                color: "#22c55e",
                              }}
                            >
                              +{Number(bet.payout).toLocaleString()}
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text-subtle)",
                              }}
                            >
                              {isRefunded
                                ? "↩"
                                : `-${Number(bet.amount).toLocaleString()}`}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 9,
                              color: "var(--text-subtle)",
                              marginTop: 1,
                            }}
                          >
                            {isWon
                              ? "payout"
                              : isRefunded
                                ? "refunded"
                                : "staked"}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* View More bets button */}
                {(() => {
                  const settledBets = bets.filter(
                    (b) => b.status !== "pending",
                  );
                  return visibleBets < settledBets.length ? (
                    <button
                      onClick={() =>
                        setVisibleBets((c) =>
                          Math.min(c + 5, settledBets.length),
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop: 4,
                        padding: "11px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: 12,
                        color: "var(--text-muted)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      View More · {settledBets.length - visibleBets} remaining
                    </button>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Share my record modal ── */}
      {showShareModal && (
        <div
          onClick={() => setShowShareModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              position: "relative",
              animation: "shareIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes shareIn {
                from { opacity: 0; transform: scale(0.93); }
                to   { opacity: 1; transform: scale(1); }
              }
            `}</style>
            <button
              onClick={() => setShowShareModal(false)}
              style={{
                position: "absolute",
                top: -36,
                right: 0,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                padding: 6,
              }}
            >
              <X size={22} />
            </button>
            <BetShareCard
              userName={userName}
              userPhotoUrl={authUser?.photoUrl ?? null}
              marketTitle={`${won.length}W – ${lost.length}L record · ${winRate}% win rate`}
              outcomePicked={
                percentile
                  ? percentile.text
                  : `#${rankToShow ?? "?"} ranked predictor`
              }
              stakeAmount={undefined}
              totalPool={undefined}
              outcomeColor={
                winRate >= 65
                  ? "#22c55e"
                  : winRate >= 50
                    ? "#3b82f6"
                    : "#f59e0b"
              }
              referralId={String(authUser?.telegramId ?? authUser?.id ?? "")}
            />
          </div>
        </div>
      )}
    </Page>
  );
};
