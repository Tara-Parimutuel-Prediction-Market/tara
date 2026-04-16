import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getMarket, getDisputes, submitDispute, Market, Dispute } from "@/api/client";
import { PwaBetForm } from "../components/PwaBetForm";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { getCategoryVisual } from "@/helpers/visuals";

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
  const [imgError, setImgError] = useState(false);

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
        <div style={{ textAlign: "center", color: "var(--text-subtle)", padding: "100px 0" }}>
          <div style={{ fontSize: "3rem", marginBottom: "16px", animation: "bounce 2s infinite" }}>🔮</div>
          <div style={{ fontWeight: 600 }}>Syncing market...</div>
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
      <div className="mesh-bg" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <Link
          to="/"
          style={{
            color: "var(--text-subtle)",
            textDecoration: "none",
            fontSize: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: 700,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-main)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-subtle)")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Feed
        </Link>

        <button
          onClick={() => {
            const url = window.location.href;
            const text = `Check out this prediction market: ${market.title}`;
            if (navigator.share) {
              navigator.share({ title: market.title, text, url }).catch(() => {});
            } else {
              navigator.clipboard.writeText(url);
              alert("Link copied to clipboard!");
            }
          }}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--text-main)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-muted)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--glass-border)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
      </div>

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-subtle)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                CROWD SENTIMENT
              </div>
              {(() => {
                const meta = (market as any).signalMeta;
                if (!meta || meta.composite === 0) return null;
                const c = meta.composite as number;
                const pct = Math.round(c * 100);
                const col = c >= 0.6 ? "#22c55e" : c >= 0.3 ? "#f59e0b" : "#ef4444";
                const label = c >= 0.6 ? "High" : c >= 0.3 ? "Moderate" : "Low";
                const r = 7, circ = 2 * Math.PI * r;
                const dash = (c * circ).toFixed(2);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={`Participants: ${meta.participantCount} · Reputation depth: ${Math.round(meta.reputationDepth * 100)}% · Maturity: ${Math.round(meta.maturityScore * 100)}%`}>
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth="2.5" />
                      <circle cx="9" cy="9" r={r} fill="none" stroke={col} strokeWidth="2.5"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        transform="rotate(-90 9 9)" />
                    </svg>
                    <span style={{ fontSize: "0.68rem", fontWeight: 800, color: col, letterSpacing: "0.04em" }}>
                      {label} confidence · {pct}%
                    </span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {market.outcomes.map((outcome, idx) => {
                const pct = totalBets > 0
                  ? (parseFloat(outcome.totalBetAmount) / totalBets) * 100
                  : 100 / market.outcomes.length;
                const colors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
                const color = colors[idx % colors.length];
                
                // Match TMA's avatar fallbacks
                const avatarUrl = !imgError
                  ? (outcome as any).imageUrl ||
                    (idx === 0
                      ? market.imageUrl
                      : idx === 1
                        ? market.imageUrlAlt || market.imageUrl
                        : null)
                  : null;
                const vis = getCategoryVisual(market.category);

                return (
                  <div key={outcome.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.92rem", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            flexShrink: 0,
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            overflow: "hidden",
                            background: vis.gradient,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              onError={() => setImgError(true)}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 900,
                                color: "#fff",
                                opacity: 0.95,
                              }}
                            >
                              {outcome.label.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {outcome.label}
                        </span>
                      </div>
                      <div
                        style={{
                          background: `${color}18`,
                          border: `1px solid ${color}40`,
                          color: color,
                          fontSize: "0.75rem",
                          fontWeight: 900,
                          padding: "2px 10px",
                          borderRadius: 99,
                          flexShrink: 0,
                        }}
                      >
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ background: "var(--bg-main)", borderRadius: "10px", height: "8px", overflow: "hidden" }}>
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
                      Nu {Number(outcome.totalBetAmount).toLocaleString()} committed
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
            <div style={{ background: "rgba(252, 211, 77, 0.1)", border: "1.5px solid rgba(252, 211, 77, 0.3)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-premium)" }}>
              {/* Header */}
              <div style={{ background: "rgba(252, 211, 77, 0.2)", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#92400e", fontSize: "1rem", letterSpacing: "0.02em" }}>DISPUTE WINDOW</div>
                  <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "2px", fontWeight: 700 }}>{disputeTimeLeft}</div>
                </div>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v3" /><path d="m3 9 2 2 2-2" /><path d="m17 9 2 2 2-2" />
                  <path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 21v-6" /><path d="M9 21h6" />
                </svg>
              </div>
              
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
                {proposedOutcome && (
                  <div>
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#b45309", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "8px" }}>PROPOSED OUTCOME</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "10px", padding: "12px 16px", width: "100%", boxSizing: "border-box" }}>
                      <span style={{ color: "#b45309", fontWeight: 800, fontSize: "1.1rem" }}>{proposedOutcome.label}</span>
                      <span style={{ background: "#f59e0b", color: "#fff", fontSize: "0.65rem", fontWeight: 900, padding: "2px 8px", borderRadius: "4px", marginLeft: "auto" }}>ADMIN</span>
                    </div>
                  </div>
                )}

                {disputeSuccess ? (
                  <div style={{ textAlign: "center", padding: "20px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "12px", border: "1.5px solid rgba(16, 185, 129, 0.3)", color: "#10b981" }}>
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
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: "12px", border: "1.5px solid var(--glass-border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "1rem", fontWeight: 700, outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "#92400e", fontWeight: 700, display: "block", marginBottom: "8px" }}>REASON FOR DISPUTE</label>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        rows={3}
                        placeholder="Provide details or links to evidence..."
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: "12px", border: "1.5px solid var(--glass-border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "var(--font-primary)" }}
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
                Market Closed
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
