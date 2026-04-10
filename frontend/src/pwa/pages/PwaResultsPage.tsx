import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Trophy, 
  TrendingUp, 
  Award, 
  ChevronDown, 
  ChevronUp,
  Globe,
  PieChart,
  Calendar
} from "lucide-react";
import {
  getMyResults,
  getResolvedMarkets,
  getMe,
  type Bet,
  type ResolvedMarket,
  type AuthUser,
} from "@/api/client";

export function PwaResultsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedMarket[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [repOpen, setRepOpen] = useState(false);

  useEffect(() => {
    getMyResults()
      .then(setBets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    getResolvedMarkets()
      .then(setResolved)
      .catch(() => {});
    getMe()
      .then(setMe)
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const won = bets.filter((b) => b.status === "won");
    const validBets = bets.filter((b) => b.status !== "refunded" && b.status !== "pending");
    const winRate = validBets.length > 0 ? (won.length / validBets.length) * 100 : 0;
    const totalPayout = bets.reduce((acc, b) => acc + (b.payout || 0), 0);
    const totalWagered = bets.reduce((acc, b) => acc + Number(b.amount), 0);
    const netGains = totalPayout - totalWagered;
    
    return {
      total: bets.length,
      won: won.length,
      lost: bets.filter(b => b.status === "lost").length,
      winRate: winRate.toFixed(0),
      netGains: Math.round(netGains)
    };
  }, [bets]);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px 100px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 900,
            marginBottom: 6,
            color: "var(--text-main)",
            letterSpacing: "-0.03em",
          }}
        >
          Performance
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--text-muted)",
            fontWeight: 600,
          }}
        >
          Your prediction history and achievements
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-subtle)" }}>
          Loading your record…
        </div>
      )}
      
      {error && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Main Dashboard Widget */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card), var(--bg-card))",
            border: "1px solid var(--glass-border)",
            borderRadius: 24,
            padding: "24px",
            marginBottom: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: 120,
              height: 120,
              background: "var(--accent)",
              opacity: 0.05,
              borderRadius: "50%",
              filter: "blur(40px)"
            }} />
            
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                Historical Accuracy
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 950, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
                  {stats.winRate}%
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: Number(stats.winRate) >= 50 ? "#22c55e" : "#f59e0b" }}>
                  {Number(stats.winRate) >= 50 ? "Excellent" : "Learning"}
                </span>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              paddingTop: 20,
              borderTop: "1px solid var(--glass-border)"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-main)" }}>{stats.total}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>Picks</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#22c55e" }}>{stats.won}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>Wins</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ef4444" }}>{stats.lost}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase" }}>Losses</div>
              </div>
            </div>
          </div>

          {/* Prediction Reputation Achievement Card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: 20,
              padding: "20px",
              marginBottom: 32,
              boxShadow: "var(--shadow-premium)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={() => setRepOpen((o) => !o)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(245, 158, 11, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f59e0b"
                }}>
                  <Award size={20} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: "var(--text-main)",
                    }}
                  >
                    Prediction Tier
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {(() => {
                      const tier = me?.reputationTier ?? "newcomer";
                      const label =
                        tier === "expert" ? "Legend" :
                        tier === "reliable" ? "Hot Hand" :
                        tier === "regular" ? "Sharpshooter" : "Rookie";
                      const color =
                        tier === "expert" ? "#f59e0b" :
                        tier === "reliable" ? "#22c55e" :
                        tier === "regular" ? "#3b82f6" : "var(--text-subtle)";
                      return (
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color }}>
                          {label} Rank
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--bg-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-subtle)"
              }}>
                {repOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {repOpen && (
              <div style={{ marginTop: 14 }}>
                {(me?.totalPredictions ?? 0) === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--text-muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    Make your first prediction to start building your reputation
                    score. Top predictors earn a Legend badge and their
                    predictions carry more weight in market probabilities.
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 24,
                        fontSize: 14,
                        color: "var(--text-subtle)",
                        marginBottom: 20,
                        background: "var(--bg-secondary)",
                        padding: "14px",
                        borderRadius: 14,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "var(--text-main)" }}>{me?.totalPredictions ?? 0}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Total Hits</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#22c55e" }}>{me?.correctPredictions ?? 0}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Correct</span>
                      </div>
                      {me?.reputationScore != null && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: "var(--accent)" }}>{Math.round(me.reputationScore * 100)}%</span>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Confidence</span>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const total = me?.totalPredictions ?? 0;
                      const correct = me?.correctPredictions ?? 0;
                      const accuracy = total > 0 ? correct / total : 0;
                      const tier = me?.reputationTier ?? "newcomer";
                      if (tier === "expert") {
                        return (
                          <>
                            <div
                              style={{
                                background: "var(--glass-border)",
                                borderRadius: 99,
                                height: 8,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: 99,
                                  background:
                                    "linear-gradient(90deg, #f59e0b, #fbbf24)",
                                }}
                              />
                            </div>
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: "#f59e0b",
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                gap: 6
                              }}
                            >
                              <Award size={14} /> Maximum Tier Reached
                            </div>
                          </>
                        );
                      }
                      let label: string,
                        color: string,
                        progressPct: number,
                        hint: string;
                      if (tier === "newcomer") {
                        progressPct = Math.min((total / 10) * 100, 100);
                        const rem = 10 - total;
                        label = "Sharpshooter";
                        color = "#3b82f6";
                        hint = `Predict ${rem} more to reach ${label}`;
                      } else if (tier === "regular") {
                        progressPct =
                          ((Math.min(total / 50, 1) +
                            Math.min(accuracy / 0.65, 1)) /
                            2) *
                          100;
                        const rem = Math.max(0, 50 - total);
                        label = "Hot Hand";
                        color = "#059669";
                        hint =
                          rem > 0 && accuracy < 0.65
                            ? `${rem} more & 65% accuracy for ${label}`
                            : rem > 0
                              ? `${rem} more for ${label}`
                              : `Reach 65% accuracy for ${label}`;
                      } else {
                        progressPct =
                          ((Math.min(total / 100, 1) +
                            Math.min(accuracy / 0.75, 1)) /
                            2) *
                          100;
                        const rem = Math.max(0, 100 - total);
                        label = "Legend";
                        color = "#f59e0b";
                        hint =
                          rem > 0 && accuracy < 0.75
                            ? `${rem} more & 75% accuracy for ${label}`
                            : rem > 0
                              ? `${rem} more for ${label}`
                              : `Reach 75% accuracy for ${label}`;
                      }
                      return (
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: "var(--text-subtle)",
                                textTransform: "uppercase"
                              }}
                            >
                              Next Rank: <span style={{ color }}>{label}</span>
                            </span>
                            <span
                              style={{ fontSize: 12, fontWeight: 900, color }}
                            >
                              {Math.round(progressPct)}%
                            </span>
                          </div>
                          <div
                            style={{
                              background: "var(--bg-secondary)",
                              borderRadius: 99,
                              height: 8,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: "100%",
                                borderRadius: 99,
                                background: color,
                                transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 11,
                              color: "var(--text-subtle)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}
                          >
                            <TrendingUp size={12} /> {hint}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Resolution Record */}
          <div style={{ marginTop: bets.length > 0 ? 8 : 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-subtle)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: "var(--text-subtle)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Resolution Record
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                {resolved.length} market{resolved.length !== 1 ? "s" : ""}
              </span>
            </div>

            {resolved.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 0",
                  color: "var(--text-subtle)",
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-subtle)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginBottom: 12 }}
                >
                  <circle cx="12" cy="8" r="6" />
                  <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                </svg>
                <div>
                  No resolved markets yet.{" "}
                  <Link to="/markets" style={{ color: "var(--accent)" }}>
                    Browse markets →
                  </Link>
                </div>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {resolved.slice(0, showAll ? undefined : 5).map((m) => (
                  <Link
                    key={m.id}
                    to={`/market/${m.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: 20,
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        boxShadow: "var(--shadow-sm)",
                        transition: "transform 0.2s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "1rem",
                            color: "var(--text-main)",
                            flex: 1,
                            lineHeight: 1.3,
                          }}
                        >
                          {m.title}
                        </span>
                        {m.category && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              color: "var(--text-muted)",
                              background: "var(--bg-secondary)",
                              padding: "4px 10px",
                              borderRadius: 8,
                              whiteSpace: "nowrap",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em"
                            }}
                          >
                            {m.category}
                          </span>
                        )}
                      </div>

                      {m.winner && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            background: "rgba(34, 197, 94, 0.08)",
                            borderRadius: 12,
                            border: "1px solid rgba(34, 197, 94, 0.15)",
                          }}
                        >
                          <Trophy size={16} stroke="#22c55e" />
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#22c55e", textTransform: "uppercase" }}>Winning Outcome</span>
                            <span
                              style={{
                                fontSize: "0.9rem",
                                fontWeight: 800,
                                color: "#22c55e",
                              }}
                            >
                              {m.winner.label}
                            </span>
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          flexWrap: "wrap",
                          paddingTop: 12,
                          borderTop: "1px solid var(--glass-border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <PieChart size={14} style={{ color: "var(--text-subtle)" }} />
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-subtle)",
                              fontWeight: 700,
                            }}
                          >
                            Nu {Number(m.totalPool).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Globe size={14} style={{ color: "var(--text-subtle)" }} />
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-subtle)",
                              fontWeight: 700,
                            }}
                          >
                            {m.participantCount} bettors
                          </span>
                        </div>
                        {m.resolvedAt && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                             <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                             <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                fontWeight: 600,
                              }}
                            >
                              {new Date(m.resolvedAt).toLocaleDateString("en-BT")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {resolved.length > 5 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: 12,
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 12,
                  color: "var(--text-main)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
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
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: showAll ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {showAll
                  ? "Show Less"
                  : `View More History (${resolved.length - 5} more)`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
