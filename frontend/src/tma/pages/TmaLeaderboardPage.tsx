import { FC, useEffect, useRef, useState } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  getLeaderboard,
  getMyResults,
  getMe,
  getCurrentSeason,
  getSeasonHistory,
  getMyTransactions,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type Bet,
  type AuthUser,
  type Season,
  type Transaction,
} from "@/api/client";
import { BetShareCard } from "@/components/BetShareCard";
import {
  Trophy,
  Flame,
  TrendingUp,
  Share2,
  Crosshair,
  Sprout,
  Medal,
  Award,
  X,
  ChevronUp,
  ArrowDownLeft,
  Banknote,
  CalendarDays,
  Clock,
  BarChart2,
  CheckCircle,
  XCircle as XCircleIcon,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = "all" | "week" | "month";

// ── Tier helpers ──────────────────────────────────────────────────────────────

function tierLabel(tier: string) {
  return tier === "legend"
    ? "Legend"
    : tier === "hot_hand"
      ? "Hot Hand"
      : tier === "sharpshooter"
        ? "Sharpshooter"
        : "Rookie";
}

function tierColor(tier: string) {
  return tier === "legend"
    ? "#f59e0b"
    : tier === "hot_hand"
      ? "#22c55e"
      : tier === "sharpshooter"
        ? "#3b82f6"
        : "#94a3b8";
}

function tierIcon(tier: string, size = 12) {
  if (tier === "legend") return <Trophy size={size} color="#f59e0b" />;
  if (tier === "hot_hand") return <Flame size={size} color="#22c55e" />;
  if (tier === "sharpshooter") return <Crosshair size={size} color="#3b82f6" />;
  return <Sprout size={size} color="#94a3b8" />;
}

function rankMedal(rank: number) {
  if (rank === 1) return <Trophy size={18} color="#f59e0b" />;
  if (rank === 2) return <Medal size={18} color="#94a3b8" />;
  if (rank === 3) return <Award size={18} color="#b45309" />;
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

const RANK_STYLES: Record<
  number,
  { bg: string; border: string; avatarBorder: string; animation: string }
> = {
  1: {
    bg: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))",
    border: "1px solid rgba(245,158,11,0.4)",
    avatarBorder: "2.5px solid #f59e0b",
    animation: "rank1Pulse 2.5s ease-in-out infinite",
  },
  2: {
    bg: "linear-gradient(135deg, rgba(148,163,184,0.12), rgba(148,163,184,0.04))",
    border: "1px solid rgba(148,163,184,0.3)",
    avatarBorder: "2.5px solid #94a3b8",
    animation: "rank2Shimmer 3s ease-in-out infinite",
  },
  3: {
    bg: "linear-gradient(135deg, rgba(180,83,9,0.12), rgba(180,83,9,0.04))",
    border: "1px solid rgba(180,83,9,0.3)",
    avatarBorder: "2.5px solid #b45309",
    animation: "rank3Glow 3.5s ease-in-out infinite",
  },
};

function LeaderRow({
  entry,
  onTap,
}: {
  entry: LeaderboardEntry;
  onTap?: () => void;
}) {
  const medal = rankMedal(entry.rank);
  const color = tierColor(entry.reputationTier);
  const rankStyle = RANK_STYLES[entry.rank];
  const displayName = entry.username
    ? `@${entry.username}`
    : entry.firstName + (entry.lastName ? ` ${entry.lastName}` : "");

  return (
    <div
      onClick={onTap}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        background: rankStyle
          ? rankStyle.bg
          : entry.isMe
            ? `linear-gradient(135deg, ${color}18, ${color}08)`
            : "transparent",
        borderRadius: rankStyle || entry.isMe ? 14 : 0,
        border: rankStyle
          ? rankStyle.border
          : entry.isMe
            ? `1px solid ${color}33`
            : "none",
        position: "relative",
        animation: rankStyle ? rankStyle.animation : "none",
        cursor: onTap ? "pointer" : "default",
      }}
    >
      {/* Rank */}
      <div
        style={{
          width: 26,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          color: "var(--text-subtle)",
        }}
      >
        {medal ?? `#${entry.rank}`}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          border: rankStyle
            ? rankStyle.avatarBorder
            : entry.isMe
              ? `2px solid ${color}`
              : "2px solid var(--glass-border)",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
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
            fontSize: 12,
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
            gap: 3,
            marginTop: 1,
          }}
        >
          {tierIcon(entry.reputationTier, 10)}
          <span
            style={{
              fontSize: 9,
              color: "var(--text-subtle)",
              fontWeight: 600,
            }}
          >
            {tierLabel(entry.reputationTier)}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-subtle)" }}>·</span>
          <span style={{ fontSize: 9, color: "var(--text-subtle)" }}>
            {entry.totalPredictions} picks
          </span>
        </div>
      </div>

      {/* Win rate + total spent */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 13,
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
        {entry.totalBetAmount > 0 && (
          <div
            style={{
              marginTop: 3,
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-subtle)",
              whiteSpace: "nowrap",
            }}
          >
            Nu {entry.totalBetAmount.toLocaleString()} spent
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Stats Bottom Sheet ─────────────────────────────────────────────────────

function MyStatsSheet({
  open,
  onClose,
  me,
  bets,
  depositTxs,
  myWeeklyDeposit,
  winRate,
  rankToShow,
  lb,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  me: AuthUser | null;
  bets: Bet[];
  depositTxs: Transaction[];
  myWeeklyDeposit: number;
  winRate: number;
  rankToShow: number | null;
  lb: LeaderboardResponse | null;
  onShare: () => void;
}) {
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const validBets = bets.filter(
    (b) => b.status !== "refunded" && b.status !== "pending",
  );
  const percentile =
    rankToShow && lb?.totalRanked
      ? percentileLabel(rankToShow, lb.totalRanked)
      : null;
  const totalDeposited = depositTxs.reduce(
    (s, t) => s + Math.abs(Number(t.amount)),
    0,
  );
  const tier = me?.reputationTier ?? "rookie";
  const color = tierColor(tier);

  const total = me?.totalPredictions ?? 0;
  const correct = me?.correctPredictions ?? 0;
  const acc = total > 0 ? correct / total : 0;

  type ProgressInfo = {
    label: string;
    nextColor: string;
    progress: number;
    hint: string;
  } | null;
  let tierProgress: ProgressInfo = null;
  if (tier === "rookie") {
    const left = Math.max(10 - total, 0);
    tierProgress = {
      label: "Rookie → Sharpshooter",
      nextColor: "#3b82f6",
      progress: Math.min(total / 10, 1),
      hint:
        left > 0 ? `${left} more picks to reach Sharpshooter` : "Almost there!",
    };
  } else if (tier === "sharpshooter") {
    const predLeft = Math.max(50 - total, 0);
    tierProgress = {
      label: "Sharpshooter → Hot Hand",
      nextColor: "#10b981",
      progress: Math.min(
        (Math.min(total / 50, 1) + Math.min(acc / 0.65, 1)) / 2,
        1,
      ),
      hint:
        predLeft > 0
          ? `${predLeft} more picks · aim for 65%+ accuracy`
          : acc < 0.65
            ? `${Math.round((0.65 - acc) * 100)}% more accuracy`
            : "Keep it up!",
    };
  } else if (tier === "hot_hand") {
    const predLeft = Math.max(100 - total, 0);
    tierProgress = {
      label: "Hot Hand → Legend",
      nextColor: "#f59e0b",
      progress: Math.min(
        (Math.min(total / 100, 1) + Math.min(acc / 0.75, 1)) / 2,
        1,
      ),
      hint:
        predLeft > 0
          ? `${predLeft} more picks · aim for 75%+ accuracy`
          : acc < 0.75
            ? `${Math.round((0.75 - acc) * 100)}% more accuracy`
            : "So close to Legend!",
    };
  }

  const recentSettled = bets.filter((b) => b.status !== "pending").slice(0, 6);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: open ? "rgba(0,0,0,0.6)" : "transparent",
          backdropFilter: open ? "blur(4px)" : "none",
          WebkitBackdropFilter: open ? "blur(4px)" : "none",
          pointerEvents: open ? "auto" : "none",
          transition: "background 0.25s",
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          background: "var(--bg-card)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--glass-border)",
          borderBottom: "none",
          maxHeight: "88vh",
          overflowY: "auto",
          transform: open ? "translateY(0)" : "translateY(105%)",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 4px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              background: "var(--glass-border)",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 16px 16px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "var(--text-main)",
              }}
            >
              My Record
            </div>
            {rankToShow && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Ranked{" "}
                <span style={{ color, fontWeight: 800 }}>#{rankToShow}</span>
                {percentile && (
                  <span style={{ color: percentile.color }}>
                    {" "}
                    · {percentile.text}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onShare}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Share2 size={13} /> Share
            </button>
            <button
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--glass-border)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "0 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Pick stats grid */}
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
                icon: <BarChart2 size={13} />,
              },
              {
                value: won.length,
                label: "Wins",
                color: "#22c55e",
                icon: <CheckCircle size={13} />,
              },
              {
                value: lost.length,
                label: "Losses",
                color: "#ef4444",
                icon: <XCircleIcon size={13} />,
              },
              {
                value: `${winRate}%`,
                label: "Win Rate",
                color: winRate >= 50 ? "#22c55e" : "#f59e0b",
                icon: <TrendingUp size={13} />,
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: 12,
                  padding: "10px 6px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    color: s.color,
                    marginBottom: 3,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: s.color }}>
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                    marginTop: 1,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Deposit activity */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {[
              {
                label: "This Week",
                value: `Nu ${myWeeklyDeposit.toLocaleString()}`,
                color: myWeeklyDeposit > 0 ? "#10b981" : "var(--text-subtle)",
                icon: <ArrowDownLeft size={13} />,
              },
              {
                label: "All Time",
                value: `Nu ${totalDeposited.toLocaleString()}`,
                color: "var(--text-main)",
                icon: <Banknote size={13} />,
              },
              {
                label: "Deposits",
                value: String(depositTxs.length),
                color: "var(--text-main)",
                icon: <CalendarDays size={13} />,
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: 12,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    color: s.color,
                    marginBottom: 3,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>
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

          {/* Tier progression */}
          {tier === "legend" ? (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(245,158,11,0.1)",
                borderRadius: 12,
                border: "1px solid rgba(245,158,11,0.25)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Trophy size={14} color="#f59e0b" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
                You've reached the top — Legend tier!
              </span>
            </div>
          ) : tierProgress ? (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--bg-secondary)",
                borderRadius: 12,
                border: "1px solid var(--glass-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                  }}
                >
                  {tierProgress.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: tierProgress.nextColor,
                  }}
                >
                  {Math.round(tierProgress.progress * 100)}%
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 99,
                  background: "var(--bg-card)",
                  overflow: "hidden",
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(tierProgress.progress * 100)}%`,
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${tierProgress.nextColor}99, ${tierProgress.nextColor})`,
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-subtle)",
                  fontWeight: 600,
                }}
              >
                {tierProgress.hint}
              </span>
            </div>
          ) : null}

          {/* Recent bets */}
          {recentSettled.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-subtle)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Clock size={11} /> Recent Results
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentSettled.map((bet) => {
                  const isWon = bet.status === "won";
                  const isRefunded = bet.status === "refunded";
                  const accentColor = isWon
                    ? "#22c55e"
                    : isRefunded
                      ? "#94a3b8"
                      : "#ef4444";
                  return (
                    <div
                      key={bet.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: isWon
                          ? "rgba(34,197,94,0.06)"
                          : isRefunded
                            ? "rgba(148,163,184,0.06)"
                            : "rgba(239,68,68,0.06)",
                        border: `1px solid ${accentColor}22`,
                        borderLeftWidth: 3,
                        borderLeftColor: accentColor,
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: `${accentColor}22`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 12,
                          fontWeight: 800,
                          color: accentColor,
                        }}
                      >
                        {isWon ? "✓" : isRefunded ? "↩" : "✗"}
                      </div>
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
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: accentColor,
                            background: `${accentColor}18`,
                            padding: "1px 6px",
                            borderRadius: 99,
                          }}
                        >
                          {bet.outcome?.label ?? "—"}
                        </span>
                      </div>
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
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--text-subtle)",
                            }}
                          >
                            {isRefunded
                              ? "↩"
                              : `−${Number(bet.amount).toLocaleString()}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Season History Sheet ──────────────────────────────────────────────────────

function SeasonsSheet({
  open,
  onClose,
  currentSeason,
  seasonHistory,
}: {
  open: boolean;
  onClose: () => void;
  currentSeason: Season | null;
  seasonHistory: Season[];
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: open ? "rgba(0,0,0,0.6)" : "transparent",
          backdropFilter: open ? "blur(4px)" : "none",
          WebkitBackdropFilter: open ? "blur(4px)" : "none",
          pointerEvents: open ? "auto" : "none",
          transition: "background 0.25s",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          background: "var(--bg-card)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--glass-border)",
          borderBottom: "none",
          maxHeight: "80vh",
          overflowY: "auto",
          transform: open ? "translateY(0)" : "translateY(105%)",
          transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "12px 0 4px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              background: "var(--glass-border)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 16px 16px",
          }}
        >
          <div
            style={{ fontSize: 16, fontWeight: 900, color: "var(--text-main)" }}
          >
            Seasons
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid var(--glass-border)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: "0 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {currentSeason && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 16,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                Current Season
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "var(--text-main)",
                }}
              >
                Week {currentSeason.weekNumber}, {currentSeason.year}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Ends{" "}
                {new Date(currentSeason.endsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-subtle)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Past Seasons
          </div>

          {seasonHistory.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "28px 0",
                color: "var(--text-subtle)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              No past seasons yet.
            </div>
          ) : (
            seasonHistory.map((s) => (
              <div
                key={s.id}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--text-main)",
                      }}
                    >
                      Week {s.weekNumber}, {s.year}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 1,
                      }}
                    >
                      {new Date(s.startsAt).toLocaleDateString()} –{" "}
                      {new Date(s.endsAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Trophy size={16} color="#f59e0b" />
                </div>
                {s.winnersSnapshot?.slice(0, 3).map((w) => (
                  <div
                    key={w.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    <span
                      style={{
                        width: 20,
                        fontSize: 12,
                        fontWeight: 900,
                        color:
                          w.rank === 1
                            ? "#f59e0b"
                            : w.rank === 2
                              ? "#94a3b8"
                              : "#b45309",
                      }}
                    >
                      #{w.rank}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-main)",
                      }}
                    >
                      {w.username ? `@${w.username}` : (w.firstName ?? "—")}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#22c55e",
                      }}
                    >
                      {w.winRate}%
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                      win rate
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Pinned Self Row ───────────────────────────────────────────────────────────

function PinnedSelfRow({
  entry,
  onTap,
}: {
  entry: LeaderboardEntry;
  onTap: () => void;
}) {
  const color = tierColor(entry.reputationTier);
  const displayName = entry.username
    ? `@${entry.username}`
    : entry.firstName + (entry.lastName ? ` ${entry.lastName}` : "");

  return (
    <div
      className="lb-pinned-self"
      onClick={onTap}
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)",
        left: 0,
        right: 0,
        zIndex: 500,
        margin: "0 12px",
        borderRadius: 16,
        background: `linear-gradient(135deg, ${color}22, ${color}0d)`,
        border: `1.5px solid ${color}55`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px ${color}22`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "11px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          minWidth: 36,
          height: 36,
          borderRadius: 10,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {entry.rank <= 3 ? (
          rankMedal(entry.rank)
        ) : (
          <span style={{ fontSize: 12, fontWeight: 900, color }}>
            #{entry.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${color}`,
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 800,
          color: "var(--text-muted)",
          flexShrink: 0,
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
            fontWeight: 800,
            color: "var(--text-main)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {displayName}
          <span
            style={{
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
        </div>
      </div>

      {/* Win rate + expand indicator */}
      <div
        style={{
          textAlign: "right",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div>
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
        <ChevronUp size={16} color={color} />
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
  const [showMyStats, setShowMyStats] = useState(false);
  const [showSeasons, setShowSeasons] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [seasonHistory, setSeasonHistory] = useState<Season[]>([]);
  const [depositTxs, setDepositTxs] = useState<Transaction[]>([]);
  const [myWeeklyDeposit, setMyWeeklyDeposit] = useState(0);
  const [period, setPeriod] = useState<Period>("all");

  // Suppress unused ref warning — kept for future scroll-to-self feature
  const _listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getLeaderboard().catch(() => null),
      getMyResults().catch(() => []),
      getMe().catch(() => null),
      getCurrentSeason().catch(() => null),
      getSeasonHistory().catch(() => []),
      getMyTransactions("deposit").catch(() => []),
    ])
      .then(([lbData, myBets, myProfile, season, history, depTxs]) => {
        setLb(lbData);
        setBets(myBets as Bet[]);
        setMe(myProfile);
        setCurrentSeason(season);
        setSeasonHistory(history as Season[]);
        const txList = depTxs as Transaction[];
        setDepositTxs(txList);
        const weekAgo = Date.now() - 7 * 86_400_000;
        setMyWeeklyDeposit(
          txList
            .filter((t) => new Date(t.createdAt).getTime() >= weekAgo)
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const winRate =
    (me?.totalPredictions ?? 0) > 0
      ? Math.round(
          ((me?.correctPredictions ?? 0) / (me?.totalPredictions ?? 1)) * 100,
        )
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

  const PERIOD_LABELS: Record<Period, string> = {
    all: "All Time",
    week: "This Week",
    month: "This Month",
  };

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

  const board = lb?.board ?? [];
  const shownBoard = board.slice(0, visibleCount);

  const selfEntry: LeaderboardEntry | null = myEntry
    ? myEntry
    : me
      ? {
          rank: rankToShow ?? board.length + 1,
          id: me.id,
          firstName: me.firstName,
          lastName: me.lastName ?? null,
          username: me.username ?? null,
          photoUrl: me.photoUrl ?? null,
          reputationScore: me.reputationScore ?? null,
          reputationTier: me.reputationTier ?? "rookie",
          totalPredictions: me.totalPredictions ?? 0,
          correctPredictions: me.correctPredictions ?? 0,
          winRate,
          totalBetAmount: Math.round(
            bets.reduce((s, b) => s + Math.abs(Number(b.amount)), 0),
          ),
          isMe: true,
        }
      : null;

  return (
    <Page>
      <style>{`
        @keyframes rank1Pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          50%       { box-shadow: 0 0 16px 4px rgba(245,158,11,0.25); }
        }
        @keyframes rank2Shimmer {
          0%, 100% { box-shadow: 0 0 0 0 rgba(148,163,184,0); }
          50%       { box-shadow: 0 0 12px 3px rgba(148,163,184,0.2); }
        }
        @keyframes rank3Glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(180,83,9,0); }
          50%       { box-shadow: 0 0 12px 3px rgba(180,83,9,0.2); }
        }
        @keyframes shareIn {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* Desktop layout */
        .lb-max-wrap { max-width: 880px; margin: 0 auto; width: 100%; }

        @media (min-width: 640px) {
          .lb-top-inner { padding: 20px 24px 12px !important; }
          .lb-title { font-size: 26px !important; }
          .lb-subtitle { font-size: 0.8rem !important; margin-top: 4px !important; }
          .lb-percentile-banner { margin: 0 24px 12px !important; padding: 9px 16px !important; font-size: 12px !important; border-radius: 12px !important; }
          .lb-period-pills { padding: 0 24px 14px !important; gap: 10px !important; }
          .lb-period-pill { padding: 7px 18px !important; font-size: 13px !important; }
          .lb-list { padding: 12px 24px !important; }
          .lb-show-more { width: 100% !important; margin: 10px 0 0 !important; }
          .lb-pinned-self {
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: min(860px, calc(100vw - 24px)) !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* ── Sticky top bar ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: "var(--bg-main)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div className="lb-max-wrap">
          {/* Title row */}
          <div
            className="lb-top-inner"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 16px 10px",
            }}
          >
            <div>
              <h1
                className="lb-title"
                style={{
                  fontSize: 22,
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
                className="lb-subtitle"
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: "2px 0 0",
                  fontWeight: 600,
                }}
              >
                {lb?.totalRanked ?? 0} ranked · {PERIOD_LABELS[period]}
              </p>
            </div>

            <button
              onClick={() => setShowSeasons(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 12px",
                borderRadius: 10,
                border: "1px solid var(--glass-border)",
                background: "var(--bg-card)",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <CalendarDays size={13} /> Seasons
            </button>
          </div>

          {/* Percentile banner */}
          {percentile && (
            <div
              className="lb-percentile-banner"
              style={{
                margin: "0 16px 10px",
                padding: "7px 12px",
                background: `${percentile.color}15`,
                border: `1px solid ${percentile.color}30`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Medal size={13} color={percentile.color} />
              <span
                style={{ fontSize: 11, fontWeight: 700, color: percentile.color }}
              >
                {percentile.text}
              </span>
            </div>
          )}

          {/* Period filter pills */}
          <div className="lb-period-pills" style={{ display: "flex", gap: 6, padding: "0 16px 12px" }}>
            {(["all", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                className="lb-period-pill"
                onClick={() => setPeriod(p)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 99,
                  border:
                    period === p
                      ? "1.5px solid #3b82f6"
                      : "1.5px solid var(--glass-border)",
                  background:
                    period === p ? "rgba(59,130,246,0.15)" : "transparent",
                  color: period === p ? "#3b82f6" : "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: period === p ? 800 : 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div className="lb-max-wrap">
      <div
        className="lb-list"
        ref={_listRef}
        style={{
          padding: "8px 12px",
          paddingBottom: selfEntry ? 100 : 20,
          minHeight: "100vh",
        }}
      >
        {board.length === 0 ? (
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
          <>
            {shownBoard.map((entry, i) => (
              <div key={entry.id}>
                <LeaderRow
                  entry={entry}
                  onTap={entry.isMe ? () => setShowMyStats(true) : undefined}
                />
                {i < shownBoard.length - 1 && <div style={{ height: 4 }} />}
              </div>
            ))}

            {/* Ellipsis gap when self is outside visible window */}
            {!myEntry &&
              selfEntry &&
              rankToShow &&
              rankToShow > visibleCount && (
                <div style={{ padding: "6px 16px", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                    · · ·
                  </span>
                </div>
              )}

            {/* Show more */}
            {visibleCount < board.length && (
              <button
                className="lb-show-more"
                onClick={() =>
                  setVisibleCount((c) => Math.min(c + 20, board.length))
                }
                style={{
                  width: "calc(100% - 32px)",
                  margin: "10px 16px 0",
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
                <TrendingUp size={14} />
                Show more · {board.length - visibleCount} remaining
              </button>
            )}
          </>
        )}
      </div>
      </div>

      {/* ── Pinned self row (hidden when sheet is open) ── */}
      {selfEntry && !showMyStats && !showSeasons && (
        <PinnedSelfRow entry={selfEntry} onTap={() => setShowMyStats(true)} />
      )}

      {/* ── My Stats bottom sheet ── */}
      <MyStatsSheet
        open={showMyStats}
        onClose={() => setShowMyStats(false)}
        me={me}
        bets={bets}
        depositTxs={depositTxs}
        myWeeklyDeposit={myWeeklyDeposit}
        winRate={winRate}
        rankToShow={rankToShow}
        lb={lb}
        onShare={() => {
          setShowMyStats(false);
          setTimeout(() => setShowShareModal(true), 200);
        }}
      />

      {/* ── Seasons bottom sheet ── */}
      <SeasonsSheet
        open={showSeasons}
        onClose={() => setShowSeasons(false)}
        currentSeason={currentSeason}
        seasonHistory={seasonHistory}
      />

      {/* ── Share record modal ── */}
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
