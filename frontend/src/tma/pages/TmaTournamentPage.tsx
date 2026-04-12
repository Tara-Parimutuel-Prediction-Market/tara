import { FC, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "@/tma/components/Page";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  getTournaments,
  getTournamentLeaderboard,
  getTournamentNominations,
  getMyTournamentParticipation,
  voteForNomination,
  registerForTournament,
  type Tournament,
  type TournamentParticipant,
  type TournamentNomination,
} from "@/api/client";
import {
  Trophy,
  Swords,
  Users,
  CheckCircle,
  Clock,
  Star,
  ChevronRight,
  Target,
  ThumbsUp,
  Zap,
  Landmark,
  CloudRain,
  Clapperboard,
  TrendingUp,
  CircleDot,
  Medal,
  Award,
  Lightbulb,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Closed";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function statusColor(status: Tournament["status"]) {
  const map: Record<Tournament["status"], string> = {
    nominations: "#818cf8",
    registration: "#22c55e",
    active: "#f59e0b",
    completed: "#6b7280",
    cancelled: "#ef4444",
  };
  return map[status] ?? "#6b7280";
}

function statusLabel(status: Tournament["status"]) {
  const map: Record<Tournament["status"], string> = {
    nominations: "Voting Open",
    registration: "Registration Open",
    active: "Live",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

const ROUND_COLORS = ["#6366f1", "#f59e0b", "#22c55e"];

function totalPool(tournament: Tournament): number {
  return tournament.rounds.reduce(
    (sum, r) => sum + (r.market ? Number(r.market.totalPool) : 0),
    0,
  );
}

function formatPool(nu: number): string {
  if (nu === 0) return "—";
  return `Nu ${nu.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ── Nominations tab ───────────────────────────────────────────────────────────

type CategoryMeta = { label: string; icon: React.ReactNode; color: string };

const CATEGORY_META: Record<string, CategoryMeta> = {
  sports: { label: "Sports", icon: <CircleDot size={10} />, color: "#22c55e" },
  politics: {
    label: "Politics",
    icon: <Landmark size={10} />,
    color: "#818cf8",
  },
  weather: {
    label: "Weather",
    icon: <CloudRain size={10} />,
    color: "#38bdf8",
  },
  entertainment: {
    label: "Entertainment",
    icon: <Clapperboard size={10} />,
    color: "#f472b6",
  },
  economy: {
    label: "Economy",
    icon: <TrendingUp size={10} />,
    color: "#f59e0b",
  },
  other: { label: "Other", icon: <Zap size={10} />, color: "#6b7280" },
};

function NominationsTab({
  tournament,
  nominations,
  myVotes,
  onVote,
}: {
  tournament: Tournament;
  nominations: TournamentNomination[];
  myVotes: Set<string>;
  onVote: (nominationId: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const isOpen =
    tournament.status === "nominations" &&
    new Date() < new Date(tournament.nominationDeadline);

  // Collect unique categories present in nominations
  const availableCategories = Array.from(
    new Set(nominations.map((n) => n.market.category ?? "other")),
  ).sort();

  // Group by round, applying category filter
  const byRound: Record<number, TournamentNomination[]> = {};
  for (const n of nominations) {
    const cat = n.market.category ?? "other";
    if (categoryFilter && cat !== categoryFilter) continue;
    if (!byRound[n.targetRound]) byRound[n.targetRound] = [];
    byRound[n.targetRound].push(n);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Explain the concept to users */}
      <div
        style={{
          margin: "0 16px",
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(245,158,11,0.07)",
          border: "1px solid rgba(245,158,11,0.2)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}
      >
        <span style={{ fontWeight: 800, color: "#f59e0b" }}>
          How it works:{" "}
        </span>
        Vote for the markets you want to bet on in each round. The most-voted
        market becomes that round's prediction. Place your bet when the round
        goes live — predict correctly to survive and advance!
      </div>

      {/* Category filter chips */}
      {availableCategories.length > 1 && (
        <div
          style={{
            margin: "0 16px",
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {/* "All" chip */}
          <button
            onClick={() => setCategoryFilter(null)}
            style={{
              padding: "5px 12px",
              borderRadius: 20,
              border: `1px solid ${categoryFilter === null ? "#f59e0b" : "var(--glass-border)"}`,
              background:
                categoryFilter === null
                  ? "rgba(245,158,11,0.15)"
                  : "var(--bg-card)",
              color: categoryFilter === null ? "#f59e0b" : "var(--text-muted)",
              fontSize: "0.7rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            All
          </button>
          {availableCategories.map((cat) => {
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(active ? null : cat)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: `1px solid ${active ? meta.color : "var(--glass-border)"}`,
                  background: active ? `${meta.color}18` : "var(--bg-card)",
                  color: active ? meta.color : "var(--text-muted)",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {isOpen && (
        <div
          style={{
            margin: "0 16px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(129,140,248,0.08)",
            border: "1px solid rgba(129,140,248,0.25)",
            fontSize: "0.75rem",
            color: "#818cf8",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Clock size={13} />
          Voting closes {timeLeft(tournament.nominationDeadline)} ·{" "}
          {3 - myVotes.size} votes remaining — pick markets you're confident
          about!
        </div>
      )}

      {Object.entries(byRound).map(([round, items]) => (
        <div key={round} style={{ margin: "0 16px" }}>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              color: ROUND_COLORS[Number(round) - 1] ?? "#818cf8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            {["Quarter Final", "Semi Final", "Final"][Number(round) - 1]} · Pick
            the market you want to bet on
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items
              .sort((a, b) => b.voteCount - a.voteCount)
              .map((n) => {
                const voted = myVotes.has(n.id);
                const canVote = isOpen && !voted && myVotes.size < 3;
                const cat = n.market.category ?? "other";
                const catMeta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: voted
                        ? "rgba(129,140,248,0.08)"
                        : "var(--bg-card)",
                      border: `1px solid ${voted ? "rgba(129,140,248,0.3)" : "var(--glass-border)"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          marginBottom: 4,
                          lineHeight: 1.3,
                        }}
                      >
                        {n.market.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Category badge */}
                        <span
                          style={{
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 10,
                            background: `${catMeta.color}18`,
                            color: catMeta.color,
                            border: `1px solid ${catMeta.color}30`,
                          }}
                        >
                          {catMeta.icon} {catMeta.label}
                        </span>
                        {/* Vote count */}
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <ThumbsUp size={10} />
                          {n.voteCount}{" "}
                          {n.voteCount === 1
                            ? "player wants to bet on this"
                            : "players want to bet on this"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => canVote && onVote(n.id)}
                      disabled={!canVote}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: voted
                          ? "rgba(129,140,248,0.15)"
                          : canVote
                            ? "linear-gradient(135deg, #6366f1, #818cf8)"
                            : "var(--glass-border)",
                        border: "none",
                        color: voted
                          ? "#818cf8"
                          : canVote
                            ? "#fff"
                            : "var(--text-subtle)",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        cursor: canVote ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      {voted ? (
                        <CheckCircle size={11} />
                      ) : (
                        <ThumbsUp size={11} />
                      )}
                      {voted ? "Picked" : "Pick"}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {/* Empty state — either no nominations or filter returned nothing */}
      {nominations.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
          }}
        >
          No markets nominated yet. The admin will add markets for you to vote
          on.
        </div>
      )}
      {nominations.length > 0 && Object.keys(byRound).length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
          }}
        >
          No{" "}
          {categoryFilter
            ? (CATEGORY_META[categoryFilter] ?? CATEGORY_META.other).label
            : ""}{" "}
          markets in this round. Try a different category.
        </div>
      )}
    </div>
  );
}

// ── Bracket tab ───────────────────────────────────────────────────────────────

function BracketTab({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate();
  const rounds = [...tournament.rounds].sort(
    (a, b) => a.roundNumber - b.roundNumber,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        margin: "0 16px",
      }}
    >
      {rounds.map((r) => {
        const color = ROUND_COLORS[r.roundNumber - 1] ?? "#818cf8";
        const isActive = r.status === "open" || r.status === "scoring";
        return (
          <div
            key={r.id}
            style={{
              padding: "14px 16px",
              borderRadius: 14,
              background: isActive
                ? `rgba(${r.roundNumber === 1 ? "99,102,241" : r.roundNumber === 2 ? "245,158,11" : "34,197,94"},0.07)`
                : "var(--bg-card)",
              border: `1.5px solid ${isActive ? color : "var(--glass-border)"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: r.market ? 8 : 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${color}22`,
                    border: `1px solid ${color}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: 900,
                    color,
                  }}
                >
                  {r.roundNumber === 3 ? (
                    <Trophy size={13} color={color} />
                  ) : (
                    <Swords size={13} color={color} />
                  )}
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "var(--text-main)",
                  }}
                >
                  {r.roundLabel}
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: `${color}18`,
                  color,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {r.status === "pending"
                  ? "Upcoming"
                  : r.status === "open"
                    ? "Live"
                    : r.status === "scoring"
                      ? "Scoring"
                      : "Done"}
              </span>
            </div>

            {r.market ? (
              <div style={{ paddingLeft: 36 }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.4,
                    marginBottom: isActive && r.market ? 10 : 0,
                  }}
                >
                  {r.market.title}
                  {r.closesAt && r.status === "open" && (
                    <span
                      style={{
                        marginLeft: 6,
                        color: "#f59e0b",
                        fontWeight: 600,
                      }}
                    >
                      · {timeLeft(r.closesAt)}
                    </span>
                  )}
                </div>
                {/* Place Bet CTA — only when round is live */}
                {r.status === "open" && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        lineHeight: 1.5,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 5,
                      }}
                    >
                      <Lightbulb
                        size={12}
                        style={{
                          flexShrink: 0,
                          marginTop: 1,
                          color: "#f59e0b",
                        }}
                      />
                      Bet now while the market is uncertain — the closer to
                      50/50, the higher your confidence score if you're right.
                    </div>
                    <button
                      onClick={() => navigate(`/markets/${r.marketId}`)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 9,
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        border: "none",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Target size={12} />
                      Place Your Bet
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-subtle)",
                  paddingLeft: 36,
                  fontStyle: "italic",
                }}
              >
                {tournament.status === "nominations"
                  ? "Vote above to pick which market is played here"
                  : "Market will be assigned after voting closes"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────

function LeaderboardTab({
  participants,
  myUserId,
}: {
  participants: TournamentParticipant[];
  myUserId?: string;
}) {
  if (participants.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "32px 20px",
          color: "var(--text-muted)",
          fontSize: "0.8rem",
        }}
      >
        No participants yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "0 16px",
      }}
    >
      {/* Scoring explanation */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(99,102,241,0.07)",
          border: "1px solid rgba(99,102,241,0.2)",
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          lineHeight: 1.6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontWeight: 800,
            color: "#818cf8",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Trophy size={12} color="#818cf8" /> How the winner is decided &amp;
          paid:{" "}
        </span>
        The finalist with the highest{" "}
        <strong style={{ color: "var(--text-main)" }}>confidence score</strong>{" "}
        wins. Betting when the market is uncertain (50/50) earns a full{" "}
        <strong style={{ color: "#f59e0b" }}>1.0</strong> — backing the obvious
        favourite earns near <strong style={{ color: "#6b7280" }}>0.0</strong>.
        Bold correct bets beat safe ones.{" "}
        <strong
          style={{
            color: "#22c55e",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Medal size={11} color="#f59e0b" /> Winner gets 60% ·{" "}
          <Award size={11} color="#9ca3af" /> Runner-up gets 25%
        </strong>{" "}
        of the prize pool (platform fees from all 3 round markets).
      </div>
      {participants.map((p, i) => {
        const isMe = p.userId === myUserId;
        const name = p.user?.username
          ? `@${p.user.username}`
          : (p.user?.firstName ?? "Player");
        const statusCol =
          p.status === "winner"
            ? "#f59e0b"
            : p.status === "eliminated"
              ? "#6b7280"
              : "#22c55e";

        return (
          <div
            key={p.id}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: isMe ? "rgba(99,102,241,0.08)" : "var(--bg-card)",
              border: `1px solid ${isMe ? "rgba(99,102,241,0.3)" : "var(--glass-border)"}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background:
                  i === 0
                    ? "rgba(245,158,11,0.15)"
                    : i === 1
                      ? "rgba(156,163,175,0.15)"
                      : i === 2
                        ? "rgba(180,120,60,0.15)"
                        : "var(--bg-main)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                fontWeight: 900,
                color:
                  i === 0
                    ? "#f59e0b"
                    : i === 1
                      ? "#9ca3af"
                      : i === 2
                        ? "#b47c3c"
                        : "var(--text-subtle)",
                flexShrink: 0,
              }}
            >
              {i === 0 ? <Trophy size={13} color="#f59e0b" /> : `#${i + 1}`}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: isMe ? "#818cf8" : "var(--text-main)",
                }}
              >
                {name} {isMe && "(you)"}
              </div>
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  marginTop: 1,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span>
                  <Target size={9} style={{ display: "inline" }} />{" "}
                  {p.correctPredictions} correct
                </span>
                {/* Confidence score bar */}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={9} style={{ display: "inline" }} />
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        p.totalConfidenceScore >= 2
                          ? "#f59e0b"
                          : "var(--text-muted)",
                    }}
                  >
                    {Number(p.totalConfidenceScore).toFixed(2)}
                  </span>
                  <div
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 2,
                      background: "var(--glass-border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (Number(p.totalConfidenceScore) / 3) * 100)}%`,
                        borderRadius: 2,
                        background:
                          Number(p.totalConfidenceScore) >= 2
                            ? "linear-gradient(90deg, #f59e0b, #fcd34d)"
                            : "linear-gradient(90deg, #818cf8, #a5b4fc)",
                      }}
                    />
                  </div>
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 6,
                background: `${statusCol}18`,
                color: statusCol,
                textTransform: "capitalize",
                flexShrink: 0,
              }}
            >
              {p.status === "active" ? `R${p.currentRound}` : p.status}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tournament detail ─────────────────────────────────────────────────────────

function TournamentDetail({
  tournament,
  myUserId,
  onBack,
}: {
  tournament: Tournament;
  myUserId?: string;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"nominations" | "bracket" | "leaderboard">(
    tournament.status === "nominations" ? "nominations" : "bracket",
  );
  const [nominations, setNominations] = useState<TournamentNomination[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [myParticipation, setMyParticipation] =
    useState<TournamentParticipant | null>(null);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);

  const openRound = tournament.rounds.find((r) => r.status === "open");

  useEffect(() => {
    getTournamentNominations(tournament.id)
      .then(setNominations)
      .catch(() => {});
    getTournamentLeaderboard(tournament.id)
      .then(setParticipants)
      .catch(() => {});
    getMyTournamentParticipation(tournament.id)
      .then(setMyParticipation)
      .catch(() => {});
  }, [tournament.id]);

  const handleVote = useCallback(
    async (nominationId: string) => {
      try {
        await voteForNomination(tournament.id, nominationId);
        setMyVotes((prev) => new Set([...prev, nominationId]));
        setNominations((prev) =>
          prev.map((n) =>
            n.id === nominationId ? { ...n, voteCount: n.voteCount + 1 } : n,
          ),
        );
      } catch (err: any) {
        alert(err?.message ?? "Could not vote");
      }
    },
    [tournament.id],
  );

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const p = await registerForTournament(tournament.id);
      setMyParticipation(p);
    } catch (err: any) {
      alert(err?.message ?? "Could not register");
    } finally {
      setRegistering(false);
    }
  };

  const color = statusColor(tournament.status);

  return (
    <div>
      {/* Back + header */}
      <div style={{ padding: "12px 16px 0" }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
            marginBottom: 10,
          }}
        >
          ← All Tournaments
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 900,
                color: "var(--text-main)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {tournament.name}
            </h2>
            {tournament.description && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                {tournament.description}
              </div>
            )}
          </div>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 8,
              background: `${color}18`,
              color,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            {statusLabel(tournament.status)}
          </span>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[
            {
              icon: <Users size={11} />,
              label: `${participants.length} / ${tournament.maxParticipants}`,
            },
            {
              icon: <Swords size={11} />,
              label: `${tournament.rounds.length} rounds`,
            },
            tournament.status === "nominations"
              ? {
                  icon: <Clock size={11} />,
                  label: timeLeft(tournament.nominationDeadline),
                }
              : tournament.status === "registration"
                ? {
                    icon: <Clock size={11} />,
                    label: timeLeft(tournament.registrationDeadline),
                  }
                : null,
          ]
            .filter(Boolean)
            .map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "var(--bg-card)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {s!.icon}
                {s!.label}
              </div>
            ))}
        </div>

        {/* Prize pool banner */}
        {(() => {
          const houseFees = totalPool(tournament);
          const prize =
            houseFees > 0
              ? houseFees * (Number(tournament.prizePoolPct) / 100)
              : null;
          return (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))",
                border: "1px solid rgba(245,158,11,0.3)",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    marginBottom: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Trophy size={11} color="#f59e0b" />
                  PRIZE POOL ({tournament.prizePoolPct}% of platform fees)
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#f59e0b",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Medal size={11} color="#f59e0b" />
                    {prize
                      ? `Nu ${(prize * 0.6).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#9ca3af",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Award size={11} color="#9ca3af" />
                    {prize
                      ? `Nu ${(prize * 0.25).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-subtle)",
                  textAlign: "right",
                  lineHeight: 1.5,
                }}
              >
                Paid from
                <br />
                house fees
              </div>
            </div>
          );
        })()}

        {/* Register CTA */}
        {tournament.status === "registration" && !myParticipation && (
          <button
            onClick={handleRegister}
            disabled={registering}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: registering ? "not-allowed" : "pointer",
              marginBottom: 6,
              opacity: registering ? 0.7 : 1,
            }}
          >
            {registering ? "Joining…" : "Join & Place Bets Each Round"}
          </button>
        )}
        {tournament.status === "registration" && !myParticipation && (
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              textAlign: "center",
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            Join now, then bet on each round's market. Predict correctly to
            advance — wrong prediction = eliminated.
          </div>
        )}

        {myParticipation && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div
              style={{
                flex: 1,
                padding: "8px 14px",
                borderRadius: 10,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.25)",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#22c55e",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle size={13} />
              Registered · Round {myParticipation.currentRound}
            </div>
            {openRound?.marketId && (
              <button
                onClick={() => navigate(`/markets/${openRound.marketId}`)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <Target size={13} />
                Place Bet
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 14,
            background: "var(--bg-main)",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {(
            [
              { key: "nominations", label: "Pick Markets" },
              { key: "bracket", label: "Bracket" },
              { key: "leaderboard", label: "Standings" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: 8,
                background: tab === t.key ? "var(--bg-card)" : "transparent",
                border: "none",
                color: tab === t.key ? "var(--text-main)" : "var(--text-muted)",
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "nominations" && (
        <NominationsTab
          tournament={tournament}
          nominations={nominations}
          myVotes={myVotes}
          onVote={handleVote}
        />
      )}
      {tab === "bracket" && <BracketTab tournament={tournament} />}
      {tab === "leaderboard" && (
        <LeaderboardTab participants={participants} myUserId={myUserId} />
      )}

      <div style={{ height: 100 }} />
    </div>
  );
}

// ── Tournament list ───────────────────────────────────────────────────────────

function TournamentCard({
  tournament,
  onSelect,
}: {
  tournament: Tournament;
  onSelect: () => void;
}) {
  const color = statusColor(tournament.status);
  const activeRound = tournament.rounds.find(
    (r) => r.status === "open" || r.status === "scoring",
  );

  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        padding: "16px",
        borderRadius: 16,
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        boxShadow: "4px 4px 12px rgba(0,0,0,0.2)",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Trophy size={20} color={color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "var(--text-main)",
            marginBottom: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tournament.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.7rem",
            color: "var(--text-muted)",
          }}
        >
          <span
            style={{
              color,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 5,
              background: `${color}15`,
            }}
          >
            {statusLabel(tournament.status)}
          </span>
          {activeRound && <span>{activeRound.roundLabel} live</span>}
          <span style={{ fontWeight: 700, color: "#f59e0b" }}>
            {formatPool(totalPool(tournament))}
          </span>
        </div>
      </div>

      <ChevronRight size={16} color="var(--text-subtle)" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const TmaTournamentPage: FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTournaments()
      .then(setTournaments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Page>
      {selected ? (
        <TournamentDetail
          tournament={selected}
          myUserId={user?.id}
          onBack={() => setSelected(null)}
        />
      ) : (
        <>
          {/* Header */}
          <div style={{ padding: "9px 16px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background:
                    "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))",
                  border: "1px solid rgba(245,158,11,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trophy size={20} color="#f59e0b" />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "var(--text-main)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  Tournaments
                </h1>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    marginTop: 3,
                  }}
                >
                  Vote on markets you want to bet on · Survive each round · Win
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
              }}
            >
              Loading…
            </div>
          ) : tournaments.length === 0 ? (
            <div
              style={{
                margin: "24px 16px",
                padding: "32px 20px",
                borderRadius: 16,
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                textAlign: "center",
              }}
            >
              <Trophy
                size={32}
                color="var(--text-muted)"
                style={{ marginBottom: 12 }}
              />
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: 6,
                }}
              >
                No tournaments yet
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                The first World Cup tournament will appear here when created by
                the admin.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                margin: "0 16px",
              }}
            >
              {tournaments.map((t) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  onSelect={() => setSelected(t)}
                />
              ))}

              {/* Duels entry point */}
              <button
                onClick={() => navigate("/challenges")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: "var(--bg-card)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Swords size={20} color="#f59e0b" />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: "var(--text-main)",
                      marginBottom: 2,
                    }}
                  >
                    Prediction Duels
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    Enter a tournament round and challenge a friend
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-subtle)" />
              </button>
            </div>
          )}

          <div style={{ height: 100 }} />
        </>
      )}
    </Page>
  );
};
