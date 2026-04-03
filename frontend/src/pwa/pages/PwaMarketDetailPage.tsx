import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getMarket, getDisputes, submitDispute, Market, Dispute } from "@/api/client";
import { PwaBetForm } from "../components/PwaBetForm";
import { useBreakpoint } from "../hooks/useBreakpoint";

export function PwaMarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_disputes, setDisputes] = useState<Dispute[]>([]);
  const [bondAmount, setBondAmount] = useState("10");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  const refreshMarket = useCallback((updatedMarket?: Market) => {
    if (updatedMarket) {
      setMarket(updatedMarket);
      return;
    }
    if (!id) return;
    getMarket(id)
      .then(setMarket)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMarket(id)
      .then(setMarket)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || !market || market.status !== "resolving") return;
    getDisputes(id).then(setDisputes).catch(() => {});
  }, [id, market?.status]);

  const handleSubmitDispute = async () => {
    if (!id) return;
    const amount = parseFloat(bondAmount);
    if (!amount || amount < 1) { setDisputeError("Minimum bond is 1 credit."); return; }
    setDisputeSubmitting(true);
    setDisputeError(null);
    try {
      await submitDispute(id, { bondAmount: amount, reason: disputeReason || undefined });
      setDisputeSuccess(true);
      getDisputes(id).then(setDisputes).catch(() => {});
    } catch (e: any) {
      setDisputeError(e.message || "Failed to submit dispute");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}
      >
        <div style={{ textAlign: "center", color: "#9ca3af" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
          <div>Loading market...</div>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ color: "#ec3942", marginBottom: "16px" }}>
          ❌ {error || "Market not found"}
        </div>
        <Link to="/" style={{ color: "#3b82f6" }}>
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const totalBets = market.outcomes.reduce(
    (sum, o) => sum + parseFloat(o.totalBetAmount),
    0,
  );

  const isOpen = market.status === "open";
  const isResolving = market.status === "resolving";
  const bp = useBreakpoint();

  const proposedOutcome = isResolving && market.proposedOutcomeId
    ? market.outcomes.find((o) => o.id === market.proposedOutcomeId)
    : null;

  const disputeTimeLeft = (() => {
    if (!market.disputeDeadlineAt) return null;
    const diff = new Date(market.disputeDeadlineAt).getTime() - Date.now();
    if (diff <= 0) return "Dispute window closed";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m remaining`;
  })();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: bp === "mobile" ? "16px 12px 100px" : "40px 20px", position: "relative" }}>
      <Link
        to="/"
        style={{
          color: "var(--text-subtle)",
          textDecoration: "none",
          fontSize: "0.85rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "24px",
          fontWeight: 700,
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-main)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-subtle)")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Back to Feed
      </Link>

      <div style={{ display: "flex", flexDirection: bp === "mobile" ? "column" : "row", gap: "32px", alignItems: "flex-start" }}>
        {/* Left Column: Info */}
        <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h1
              style={{
                fontSize: bp === "mobile" ? "1.5rem" : "2rem",
                fontWeight: 900,
                color: "var(--text-main)",
                marginBottom: "12px",
                lineHeight: 1.2,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
              }}
            >
              {market.title}
            </h1>
            {market.description && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                  fontWeight: 500,
                }}
              >
                {market.description}
              </p>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
            }}
          >
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "16px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ color: "var(--text-subtle)", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>Status</div>
              <div style={{ color: isOpen ? "#22c55e" : isResolving ? "#f59e0b" : "var(--text-muted)", fontWeight: 800, fontSize: "0.9rem" }}>
                {market.status.toUpperCase()}
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "16px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ color: "var(--text-subtle)", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>Total Pool</div>
              <div style={{ color: "var(--text-main)", fontWeight: 800, fontSize: "0.9rem" }}>Nu {Number(market.totalPool).toLocaleString()}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-md)", padding: "16px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ color: "var(--text-subtle)", fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.05em" }}>Ends</div>
              <div style={{ color: "var(--text-main)", fontWeight: 800, fontSize: "0.9rem" }}>
                {market.closesAt ? new Date(market.closesAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "N/A"}
              </div>
            </div>
          </div>

          {/* Crowd sentiment */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "24px", boxShadow: "var(--shadow-premium)" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-subtle)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "20px" }}>
              CROWD SENTIMENT
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {market.outcomes.map((outcome, idx) => {
                const pct = totalBets > 0
                  ? (parseFloat(outcome.totalBetAmount) / totalBets) * 100
                  : 100 / market.outcomes.length;
                const colors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
                const color = colors[idx % colors.length];
                
                return (
                  <div key={outcome.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{outcome.label}</span>
                      <span style={{ fontWeight: 800, color: color }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ background: "#f1f5f9", borderRadius: "10px", height: "8px", overflow: "hidden" }}>
                      <div style={{ 
                        background: color, 
                        height: "100%", 
                        width: `${pct}%`, 
                        borderRadius: "10px", 
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: `0 0 10px ${color}40`,
                      }} />
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "4px", fontWeight: 600 }}>
                      Nu {Number(outcome.totalBetAmount).toLocaleString()} placed
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction */}
        <div style={{ flex: 1, position: bp === "mobile" ? "static" : "sticky", top: "100px", width: "100%" }}>
          {isOpen ? (
            <div style={{ background: "var(--bg-card)", border: "1.5px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "24px", boxShadow: "var(--shadow-premium)", backdropFilter: "var(--glass-blur)" }}>
              <PwaBetForm market={market} onBetPlaced={refreshMarket} />
            </div>
          ) : isResolving ? (
            <div style={{ background: "#fff9eb", border: "1.5px solid #fcd34d", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-premium)" }}>
              {/* Header */}
              <div style={{ background: "#fef3c7", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#92400e", fontSize: "1rem", letterSpacing: "0.02em" }}>DISPUTE WINDOW</div>
                  <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "2px", fontWeight: 700 }}>{disputeTimeLeft}</div>
                </div>
                <div style={{ fontSize: "2rem" }}>⚖️</div>
              </div>
              
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
                {proposedOutcome && (
                  <div>
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#b45309", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>PROPOSED OUTCOME</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#fff", border: "1px solid #fde68a", borderRadius: "10px", padding: "12px 16px", width: "100%", boxSizing: "border-box" }}>
                      <span style={{ color: "#b45309", fontWeight: 800, fontSize: "1.1rem" }}>{proposedOutcome.label}</span>
                      <span style={{ background: "#f59e0b", color: "#fff", fontSize: "0.65rem", fontWeight: 900, padding: "2px 8px", borderRadius: "4px", marginLeft: "auto" }}>ADMIN</span>
                    </div>
                  </div>
                )}

                {disputeSuccess ? (
                  <div style={{ textAlign: "center", padding: "20px", background: "#ecfdf5", borderRadius: "12px", border: "1.5px solid #6ee7b7", color: "#065f46" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>✅</div>
                    <div style={{ fontWeight: 800 }}>Dispute Submitted</div>
                    <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>Admin will review the evidence and make a final call.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700, display: "block", marginBottom: "8px" }}>BOND AMOUNT (Nu)</label>
                      <input
                        type="number"
                        min="1"
                        value={bondAmount}
                        onChange={(e) => setBondAmount(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: "12px", border: "1.5px solid #fde68a", fontSize: "1rem", fontWeight: 700, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700, display: "block", marginBottom: "8px" }}>REASON FOR DISPUTE</label>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        rows={3}
                        placeholder="Provide details or links to evidence..."
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: "12px", border: "1.5px solid #fde68a", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "var(--font-primary)" }}
                      />
                    </div>
                    {disputeError && <div style={{ color: "#dc2626", fontSize: "0.85rem", fontWeight: 600 }}>{disputeError}</div>}
                    <button
                      onClick={handleSubmitDispute}
                      disabled={disputeSubmitting}
                      style={{ 
                        width: "100%", 
                        padding: "16px", 
                        borderRadius: "12px", 
                        border: "none", 
                        background: disputeSubmitting ? "#d1d5db" : "#f59e0b", 
                        color: "#fff", 
                        fontWeight: 900, 
                        fontSize: "1rem", 
                        cursor: disputeSubmitting ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={(e) => !disputeSubmitting && (e.currentTarget.style.transform = "scale(1.02)")}
                      onMouseLeave={(e) => !disputeSubmitting && (e.currentTarget.style.transform = "scale(1)")}
                    >
                      {disputeSubmitting ? "PROCESSING..." : "SUBMIT DISPUTE"}
                    </button>
                    <div style={{ fontSize: "0.7rem", color: "#b45309", textAlign: "center", fontWeight: 600 }}>
                      * Bonds are fully refunded after resolution.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : market.status === "upcoming" ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1.5px solid var(--glass-border)",
                borderRadius: "var(--radius-lg)",
                padding: "40px 24px",
                textAlign: "center",
                boxShadow: "var(--shadow-premium)",
                backdropFilter: "var(--glass-blur)",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "20px" }}>🚀</div>
              <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "1.3rem", marginBottom: "12px", fontFamily: "var(--font-display)" }}>
                Opening Soon
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "1rem", lineHeight: 1.5 }}>
                Bets will be accepted starting<br />
                <strong style={{ color: "#3b82f6", fontSize: "1.1rem" }}>
                  {new Date(market.opensAt!).toLocaleTimeString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1.5px solid var(--glass-border)",
                borderRadius: "var(--radius-lg)",
                padding: "40px 24px",
                textAlign: "center",
                boxShadow: "var(--shadow-premium)",
              }}
            >
               <div style={{ fontSize: "3rem", marginBottom: "20px" }}>🔒</div>
              <div style={{ fontWeight: 900, color: "var(--text-muted)", fontSize: "1.2rem", marginBottom: "8px" }}>
                Betting Closed
              </div>
              <p style={{ color: "var(--text-subtle)", fontSize: "0.9rem" }}>
                This market is currently being resolved or has finished.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
