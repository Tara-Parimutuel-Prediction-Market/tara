import { FC, useEffect, useState } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, Market } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { Link } from "@/tma/components/Link/Link";

export const MarketsPage: FC = () => {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMarkets();
        setMarkets(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <Page back={false}>
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Spinner size="l" />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page back={false}>
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          {error}
        </div>
      </Page>
    );
  }

  const openMarkets = markets.filter((m) => m.status === "open");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const otherMarkets = markets.filter(
    (m) => !["open", "upcoming"].includes(m.status),
  );

  return (
    <Page back={false}>
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          padding: "0 0 100px",
        }}
      >
        <div className="mesh-bg" />

        <div
          style={{
            padding: "48px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 32,
            position: "relative",
          }}
        >
          {/* User Account Section */}
          {user && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                boxShadow: "var(--shadow-premium)",
                backdropFilter: "var(--glass-blur)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: "1.2rem",
                  }}
                >
                  {user.firstName[0]}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      color: "var(--text-main)",
                      fontSize: "1rem",
                    }}
                  >
                    {user.firstName} {user.lastName || ""}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-subtle)",
                      fontWeight: 600,
                    }}
                  >
                    {user.isAdmin ? "Administrator" : "Predictor"}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    color: "var(--text-subtle)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 2,
                  }}
                >
                  Balance
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    color: "var(--text-main)",
                    fontSize: "1.1rem",
                  }}
                >
                  Nu {(user.creditsBalance ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Open Markets */}
          {openMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: 4,
                }}
              >
                {/* Pulsing red dot */}
                <div style={{ position: "relative", width: 10, height: 10 }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "#ef4444",
                      animation: "livePulse 1.6s ease-out infinite",
                    }}
                  />
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#ef4444",
                      position: "relative",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Live Markets
                </div>
              </div>
              <style>{`
                @keyframes livePulse {
                  0%   { transform: scale(1);   opacity: 0.9; }
                  70%  { transform: scale(2.4); opacity: 0; }
                  100% { transform: scale(1);   opacity: 0; }
                }
              `}</style>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {openMarkets.map((market) => {
                  const totalPool = Number(market.totalPool);
                  const bettorCount =
                    market.signalMeta?.participantCount ?? null;
                  const colors = [
                    "#22c55e",
                    "#ef4444",
                    "#f59e0b",
                    "#3b82f6",
                    "#8b5cf6",
                  ];
                  return (
                    <div
                      key={market.id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "16px",
                        boxShadow: "var(--shadow-sm)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {/* Title row + live badge */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--text-main)",
                            fontSize: "0.95rem",
                            lineHeight: 1.3,
                            flex: 1,
                          }}
                        >
                          {market.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          {bettorCount != null && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              {/* mini pulsing dot */}
                              <div
                                style={{
                                  position: "relative",
                                  width: 7,
                                  height: 7,
                                }}
                              >
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                    animation:
                                      "livePulse 1.6s ease-out infinite",
                                  }}
                                />
                                <div
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                    position: "relative",
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  color: "#ef4444",
                                }}
                              >
                                {bettorCount} live
                              </span>
                            </div>
                          )}
                          <div
                            style={{
                              fontWeight: 900,
                              color: "#22c55e",
                              fontSize: "0.85rem",
                            }}
                          >
                            Nu {totalPool.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Outcome buttons as CTA */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            market.outcomes.length === 2
                              ? "1fr 1fr"
                              : `repeat(${Math.min(market.outcomes.length, 3)}, 1fr)`,
                          gap: 8,
                        }}
                      >
                        {market.outcomes.map((outcome, idx) => {
                          const pct =
                            outcome.lmsrProbability != null &&
                            outcome.lmsrProbability > 0
                              ? Math.round(outcome.lmsrProbability * 100)
                              : totalPool > 0
                                ? Math.round(
                                    (Number(outcome.totalBetAmount) /
                                      totalPool) *
                                      100,
                                  )
                                : Math.round(100 / market.outcomes.length);
                          const color = colors[idx % colors.length];
                          return (
                            <Link
                              key={outcome.id}
                              to={`/market/${market.id}`}
                              style={{ textDecoration: "none" }}
                            >
                              <button
                                style={{
                                  width: "100%",
                                  padding: "10px 8px",
                                  background: `${color}18`,
                                  border: `1.5px solid ${color}44`,
                                  borderRadius: 10,
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    color: "var(--text-main)",
                                    lineHeight: 1.2,
                                    textAlign: "center",
                                  }}
                                >
                                  {outcome.label}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.78rem",
                                    fontWeight: 900,
                                    color,
                                  }}
                                >
                                  {pct}%
                                </span>
                              </button>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Markets */}
          {upcomingMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: 4,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#3b82f6",
                  }}
                />
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Upcoming
                </div>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {upcomingMarkets.map((market) => (
                  <Link
                    key={market.id}
                    to={`/market/${market.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        opacity: 0.8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--text-main)",
                            fontSize: "0.95rem",
                            marginBottom: 4,
                          }}
                        >
                          {market.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            fontWeight: 500,
                          }}
                        >
                          {market.opensAt
                            ? `Opens ${new Date(market.opensAt).toLocaleDateString()}`
                            : "Coming soon"}
                        </div>
                      </div>
                      <div style={{ opacity: 0.5 }}>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Past Markets */}
          {otherMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Past Markets
                </div>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {otherMarkets.map((market) => (
                  <Link
                    key={market.id}
                    to={`/market/${market.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        borderRadius: "var(--radius-md)",
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        opacity: 0.7,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {market.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          color: "var(--text-subtle)",
                          textTransform: "uppercase",
                          background: "#e2e8f0",
                          padding: "2px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {market.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {markets.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>🏹</div>
              <div
                style={{
                  fontWeight: 900,
                  color: "var(--text-main)",
                  fontSize: "1.2rem",
                  marginBottom: 8,
                }}
              >
                No Markets Found
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Check back later for new archery predictions!
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};
