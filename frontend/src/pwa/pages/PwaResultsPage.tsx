import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyResults, type Bet } from "@/api/client";

const STATUS_COLOR: Record<string, string> = {
  won: "#22c55e",
  lost: "#ef4444",
  refunded: "#64748b",
};

function ResultCard({ bet }: { bet: Bet }) {
  const color = STATUS_COLOR[bet.status] ?? "#64748b";
  const won = bet.status === "won";
  const refunded = bet.status === "refunded";

  return (
    <div style={{
      background: "var(--glass-bg)",
      border: `1px solid ${color}44`,
      borderRadius: 14,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)", flex: 1 }}>
          {bet.market?.title ?? bet.marketId}
        </span>
        <span style={{
          fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px",
          borderRadius: 20, background: `${color}22`, color,
          whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {bet.status}
        </span>
      </div>

      <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
        Pick: <strong style={{ color: "var(--text-main)" }}>{bet.outcome?.label ?? bet.outcomeId}</strong>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "0.85rem", fontWeight: 600, paddingTop: 4,
        borderTop: "1px solid var(--glass-border)",
      }}>
        <span style={{ color: "var(--text-subtle)" }}>
          Staked: BTN {Number(bet.amount).toLocaleString()}
        </span>
        {won && bet.payout != null && (
          <span style={{ color: "#22c55e" }}>
            Won: BTN {Number(bet.payout).toLocaleString()}
            <span style={{ fontSize: "0.72rem", marginLeft: 4, color: "#22c55e99" }}>
              ({(Number(bet.payout) / Number(bet.amount)).toFixed(2)}x)
            </span>
          </span>
        )}
        {refunded && (
          <span style={{ color: "#64748b" }}>Refunded: BTN {Number(bet.amount).toLocaleString()}</span>
        )}
        {bet.status === "lost" && (
          <span style={{ color: "#ef4444" }}>–BTN {Number(bet.amount).toLocaleString()}</span>
        )}
      </div>

      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
        {new Date(bet.placedAt).toLocaleString()} ·{" "}
        <Link to={`/market/${bet.marketId}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
          View market →
        </Link>
      </div>
    </div>
  );
}

export function PwaResultsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyResults()
      .then(setBets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const totalWon = won.reduce((s, b) => s + Number(b.payout ?? 0), 0);
  const winRate = bets.filter((b) => b.status !== "refunded").length > 0
    ? ((won.length / bets.filter((b) => b.status !== "refunded").length) * 100).toFixed(0)
    : "0";

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 4, color: "var(--text-main)" }}>
        Results
      </h1>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20 }}>
        Settled predictions
      </p>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-subtle)" }}>Loading…</div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#ef4444" }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Summary strip */}
          {bets.length > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10, marginBottom: 24,
            }}>
              {[
                { label: "Total bets", value: bets.length },
                { label: "Won", value: won.length, color: "#22c55e" },
                { label: "Lost", value: lost.length, color: "#ef4444" },
                { label: "Win rate", value: `${winRate}%`, color: Number(winRate) >= 50 ? "#22c55e" : "#f59e0b" },
              ].map((s) => (
                <div key={s.label} style={{
                  background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                  borderRadius: 12, padding: "12px 10px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: (s as any).color ?? "var(--text-main)" }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {totalWon > 0 && (
            <div style={{
              background: "linear-gradient(135deg, #22c55e22, #2b7fdb22)",
              border: "1px solid #22c55e44", borderRadius: 12,
              padding: "12px 16px", marginBottom: 20,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "var(--text-subtle)", fontSize: "0.85rem" }}>Total winnings</span>
              <span style={{ color: "#22c55e", fontWeight: 800, fontSize: "1rem" }}>
                BTN {totalWon.toLocaleString()}
              </span>
            </div>
          )}

          {bets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-subtle)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
                <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
                <path d="M6 5h12v7a6 6 0 0 1-12 0V5Z" />
                <path d="M12 19v3" />
                <path d="M8 22h8" />
              </svg>
              <div>No results yet.{" "}
                <Link to="/markets" style={{ color: "var(--accent)" }}>Start predicting →</Link>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bets.map((bet) => <ResultCard key={bet.id} bet={bet} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
