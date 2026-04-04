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
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
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
      <div style={{ position: "relative", minHeight: "100vh", padding: "0 0 100px" }}>
        <div className="mesh-bg" />
        
        <div style={{ padding: "48px 16px 24px", display: "flex", flexDirection: "column", gap: 32, position: "relative" }}>
          {/* User Account Section */}
          {user && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "20px", boxShadow: "var(--shadow-premium)", backdropFilter: "var(--glass-blur)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: "1.2rem" }}>
                  {user.firstName[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "1rem" }}>{user.firstName} {user.lastName || ""}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontWeight: 600 }}>{user.isAdmin ? "Administrator" : "Predictor"}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Balance</div>
                <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "1.1rem" }}>Nu {(user.creditsBalance ?? 0).toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Open Markets */}
          {openMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Open Markets</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {openMarkets.map((market) => (
                  <Link key={market.id} to={`/market/${market.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "var(--shadow-sm)", transition: "transform 0.2s" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.95rem", marginBottom: 4 }}>{market.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{market.outcomes.length} outcomes</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, color: "#22c55e", fontSize: "1rem" }}>Nu {Number(market.totalPool).toLocaleString()}</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-subtle)", fontWeight: 700, textTransform: "uppercase" }}>Pool</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Markets */}
          {upcomingMarkets.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Upcoming</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {upcomingMarkets.map((market) => (
                  <Link key={market.id} to={`/market/${market.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.8 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.95rem", marginBottom: 4 }}>{market.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                          {market.opensAt ? `Opens ${new Date(market.opensAt).toLocaleDateString()}` : "Coming soon"}
                        </div>
                      </div>
                      <div style={{ opacity: 0.5 }}>
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Past Markets</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {otherMarkets.map((market) => (
                  <Link key={market.id} to={`/market/${market.id}`} style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
                      <div style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: "0.9rem" }}>{market.title}</div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-subtle)", textTransform: "uppercase", background: "#e2e8f0", padding: "2px 8px", borderRadius: 6 }}>
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
              <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "1.2rem", marginBottom: 8 }}>No Markets Found</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Check back later for new archery predictions!</div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};
