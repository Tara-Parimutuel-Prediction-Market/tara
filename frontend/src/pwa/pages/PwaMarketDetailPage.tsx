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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: bp === "mobile" ? "var(--space-md) var(--space-sm) 100px" : "var(--space-xl) var(--space-md)", position: "relative" }}>
      <div className="mesh-bg" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
        <Link
          to="/"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 800,
            transition: "all 0.2s ease",
            padding: "8px 12px",
            background: "var(--bg-card)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-main)"; e.currentTarget.style.borderColor = "var(--text-subtle)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
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
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 800,
            color: "var(--text-main)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-subtle)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: bp === "mobile" ? "column" : "row", gap: "var(--space-xl)", alignItems: "flex-start" }}>
        {/* Left Column: Info */}
        <div style={{ flex: 1.6, display: "flex", flexDirection: "column", gap: "var(--space-lg)", width: "100%" }}>
          <div>
            <h1
              style={{
                fontSize: bp === "mobile" ? "1.75rem" : "2.5rem",
                fontWeight: 900,
                color: "var(--text-main)",
                marginBottom: "var(--space-sm)",
                lineHeight: 1.15,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.03em",
              }}
            >
              {market.title}
            </h1>
            {market.description && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: bp === "mobile" ? "0.95rem" : "1.05rem",
                  lineHeight: 1.6,
                  fontWeight: 500,
                  maxWidth: "70ch",
                }}
              >
                {market.description}
              </p>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: bp === "mobile" ? "1fr" : "repeat(3, 1fr)",
              gap: "var(--space-md)",
            }}
          >
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ color: "var(--text-subtle)", fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.08em" }}>Status</div>
              <div style={{ color: isOpen ? "var(--color-success)" : isResolving ? "var(--color-warning)" : "var(--text-muted)", fontWeight: 900, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }}></span>
                {market.status.toUpperCase()}
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ color: "var(--text-subtle)", fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.08em" }}>Total Pool</div>
              <div style={{ color: "var(--text-main)", fontWeight: 900, fontSize: "1rem" }}>Nu {Number(market.totalPool).toLocaleString()}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ color: "var(--text-subtle)", fontSize: "0.68rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.08em" }}>Deadline</div>
              <div style={{ color: "var(--text-main)", fontWeight: 900, fontSize: "1rem" }}>
                {market.closesAt ? new Date(market.closesAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
              </div>
            </div>
          </div>

          {/* Crowd sentiment */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: bp === "mobile" ? "var(--space-md)" : "var(--space-lg)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 900, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Crowd Sentiment
              </div>
              {(() => {
                const meta = (market as any).signalMeta;
                if (!meta || meta.composite === 0) return null;
                const c = meta.composite as number;
                const pct = Math.round(c * 100);
                const col = c >= 0.6 ? "var(--color-success)" : c >= 0.3 ? "var(--color-warning)" : "var(--color-danger)";
                const label = c >= 0.6 ? "Strong" : c >= 0.3 ? "Balanced" : "Low";
                const r = 7, circ = 2 * Math.PI * r;
                const dash = (c * circ).toFixed(2);
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }} title={`Participants: ${meta.participantCount}`}>
                    <div style={{ position: "relative", width: 22, height: 22 }}>
                      <svg width="22" height="22" viewBox="0 0 18 18">
                        <circle cx="9" cy="9" r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth="3" />
                        <circle cx="9" cy="9" r={r} fill="none" stroke={col} strokeWidth="3"
                          strokeDasharray={`${dash} ${circ}`}
                          strokeLinecap="round"
                          transform="rotate(-90 9 9)" />
                      </svg>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 900, color: col, letterSpacing: "0.02em" }}>
                      {label} Confidence ({pct}%)
                    </span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {market.outcomes.map((outcome, idx) => {
                const pct = totalBets > 0
                  ? (parseFloat(outcome.totalBetAmount) / totalBets) * 100
                  : 100 / market.outcomes.length;
                
                const colors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
                const color = colors[idx % colors.length];
                
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-xs)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            flexShrink: 0,
                            width: 36,
                            height: 36,
                            borderRadius: "var(--radius-full)",
                            overflow: "hidden",
                            background: vis.gradient,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px solid #fff",
                            boxShadow: "var(--shadow-sm)",
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
                                fontSize: 14,
                                fontWeight: 900,
                                color: "#fff",
                              }}
                            >
                              {outcome.label.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "1rem" }}>
                          {outcome.label}
                        </span>
                      </div>
                      <div
                        style={{
                          background: `${color}15`,
                          color: color,
                          fontSize: "0.8rem",
                          fontWeight: 900,
                          padding: "4px 12px",
                          borderRadius: "var(--radius-full)",
                          flexShrink: 0,
                          border: `1px solid ${color}30`,
                        }}
                      >
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-full)", height: "10px", overflow: "hidden", position: "relative" }}>
                      <div style={{ 
                        background: color, 
                        height: "100%", 
                        width: `${pct}%`, 
                        borderRadius: "var(--radius-full)", 
                        transition: "width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        boxShadow: `0 0 12px ${color}40`,
                      }} />
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "6px", fontWeight: 700, display: "flex", justifyContent: "flex-end" }}>
                      Nu {Number(outcome.totalBetAmount).toLocaleString()} total bet
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction */}
        <div style={{ flex: 1, position: bp === "mobile" ? "static" : "sticky", top: "calc(var(--header-height) + var(--space-md))", width: "100%" }}>
          {isOpen ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", boxShadow: "var(--shadow-lg)", backdropFilter: "var(--glass-blur)" }}>
              <PwaBetForm market={market} onBetPlaced={refreshMarket} />
            </div>
          ) : isResolving ? (
            <div style={{ background: "var(--bg-card)", border: "1.5px solid var(--color-warning)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
              {/* Header */}
              <div style={{ background: "rgba(245, 158, 11, 0.08)", padding: "var(--space-md)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "var(--color-warning)", fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Dispute Window</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 700 }}>{disputeTimeLeft}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v3" /><path d="m3 9 2 2 2-2" /><path d="m17 9 2 2 2-2" />
                    <path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 21v-6" /><path d="M9 21h6" />
                  </svg>
                </div>
              </div>
              
              <div style={{ padding: "var(--space-lg)", display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
                {proposedOutcome && (
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 900, color: "var(--text-subtle)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Proposed Outcome</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 18px" }}>
                      <span style={{ color: "var(--text-main)", fontWeight: 900, fontSize: "1.1rem" }}>{proposedOutcome.label}</span>
                      <span style={{ background: "var(--color-warning)", color: "#fff", fontSize: "0.65rem", fontWeight: 900, padding: "3px 8px", borderRadius: "4px" }}>ORACLE</span>
                    </div>
                  </div>
                )}

                {disputeSuccess ? (
                  <div style={{ textAlign: "center", padding: "24px", background: "rgba(34, 197, 94, 0.08)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-success)", color: "var(--color-success)" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "12px" }}>✅</div>
                    <div style={{ fontWeight: 900, fontSize: "1.1rem" }}>Dispute Logged</div>
                    <div style={{ fontSize: "0.85rem", marginTop: "6px", fontWeight: 600 }}>The Oracle will re-evaluate based on community evidence.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 800, display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bond Amount (Nu)</label>
                      <input
                        type="number"
                        min="1"
                        value={bondAmount}
                        onChange={(e) => setBondAmount(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "1rem", fontWeight: 800, outline: "none", transition: "all 0.2s" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-warning)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 800, display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dispute Reasoning</label>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        rows={4}
                        placeholder="Explain why the proposed outcome is incorrect..."
                        style={{ width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-main)", color: "var(--text-main)", fontSize: "0.95rem", outline: "none", resize: "none", fontFamily: "var(--font-primary)", fontWeight: 500 }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-warning)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      />
                    </div>
                    {disputeError && <div style={{ color: "var(--color-danger)", fontSize: "0.85rem", fontWeight: 700 }}>⚠️ {disputeError}</div>}
                    <button
                      onClick={handleSubmitDispute}
                      disabled={disputeSubmitting}
                      style={{ 
                        width: "100%", 
                        padding: "16px", 
                        borderRadius: "var(--radius-md)", 
                        border: "none", 
                        background: disputeSubmitting ? "var(--text-subtle)" : "var(--color-warning)", 
                        color: "#fff", 
                        fontWeight: 900, 
                        fontSize: "1.05rem", 
                        cursor: disputeSubmitting ? "not-allowed" : "pointer",
                        boxShadow: "0 8px 20px -6px rgba(245, 158, 11, 0.4)",
                        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                      onMouseEnter={(e) => !disputeSubmitting && (e.currentTarget.style.transform = "translateY(-2px)")}
                      onMouseLeave={(e) => !disputeSubmitting && (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      {disputeSubmitting ? "Submitting..." : "Submit Dispute"}
                    </button>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-subtle)", textAlign: "center", fontWeight: 700 }}>
                      * Bonds are held in escrow until the final resolution.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : market.status === "upcoming" ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "48px 24px",
                textAlign: "center",
                boxShadow: "var(--shadow-lg)",
                backdropFilter: "var(--glass-blur)",
              }}
            >
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-info)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                  <path d="M9 12H4s.5-1 1-4c2 0 3 .5 3 .5" />
                  <path d="M12 15v5s1 .5 4 1c0-2-.5-3-.5-3" />
                </svg>
              </div>
              <div style={{ fontWeight: 900, color: "var(--text-main)", fontSize: "1.4rem", marginBottom: "12px", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                Prophecy Loading
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6, fontWeight: 500 }}>
                This portal opens for betting on<br />
                <strong style={{ color: "var(--color-info)", fontSize: "1.1rem", fontWeight: 900, display: "block", marginTop: 8 }}>
                  {new Date(market.opensAt!).toLocaleString(undefined, {
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
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "48px 24px",
                textAlign: "center",
                boxShadow: "var(--shadow-lg)",
              }}
            >
               <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div style={{ fontWeight: 900, color: "var(--text-muted)", fontSize: "1.25rem", marginBottom: "8px", fontFamily: "var(--font-display)" }}>
                Portal Sealed
              </div>
              <p style={{ color: "var(--text-subtle)", fontSize: "0.95rem", lineHeight: 1.5, fontWeight: 500 }}>
                This prediction market has concluded and is no longer accepting bets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
