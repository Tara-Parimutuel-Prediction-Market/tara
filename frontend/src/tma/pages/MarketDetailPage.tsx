import { FC, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarket, getDisputes, submitDispute, Market, Dispute } from "@/api/client";
import { Link } from "@/tma/components/Link/Link";

export const MarketDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDisputes] = useState<Dispute[]>([]);
  const [bondAmount, setBondAmount] = useState("10");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getMarket(id);
        setMarket(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
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
      <Page back={true}>
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Spinner size="l" />
        </div>
      </Page>
    );
  }

  if (error || !market) {
    return (
      <Page back={true}>
        <Placeholder header="Error" description={error || "Market not found"} />
      </Page>
    );
  }

  const isResolving = market.status === "resolving";

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

  const isOpen = market.status === "open";

  return (
    <Page back={true}>
      <div style={{ position: "relative", minHeight: "100vh", padding: "0 0 100px" }}>
        <div className="mesh-bg" />
        
        <div style={{ padding: "48px 16px 24px", display: "flex", flexDirection: "column", gap: 24, position: "relative" }}>
          {/* Header Section */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "20px", boxShadow: "var(--shadow-premium)", backdropFilter: "var(--glass-blur)" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-subtle)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Market Details</div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text-main)", marginBottom: 12, lineHeight: 1.2, fontFamily: "var(--font-display)" }}>{market.title}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <div style={{ background: "var(--bg-secondary)", padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 800, color: isOpen ? "#22c55e" : isResolving ? "#f59e0b" : "var(--text-muted)" }}>
                {market.status.toUpperCase()}
              </div>
              <div style={{ background: "var(--bg-secondary)", padding: "4px 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 800, color: "var(--text-main)" }}>
                Nu {Number(market.totalPool).toLocaleString()}
              </div>
            </div>
            {market.description && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5, marginTop: 16, fontWeight: 500 }}>{market.description}</p>
            )}
          </div>

          {/* Betting Options */}
          {isOpen && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "20px", boxShadow: "var(--shadow-premium)" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-subtle)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Payment Method</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <Link to={`/dkbank-bet/${market.id}`} style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "16px 8px", background: "linear-gradient(135deg, #ff8c00, #ff4500)", color: "#fff", border: "none", borderRadius: 12, fontSize: "0.75rem", fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 12px rgba(255,140,0,0.3)" }}>
                    DK BANK
                  </button>
                </Link>
                <Link to={`/ton-bet/${market.id}`} style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "16px 8px", background: "linear-gradient(135deg, #00b4ed, #0072bc)", color: "#fff", border: "none", borderRadius: 12, fontSize: "0.75rem", fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,180,237,0.3)" }}>
                    TON
                  </button>
                </Link>
                <Link to={`/market/${market.id}`} style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "16px 8px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#fff", border: "none", borderRadius: 12, fontSize: "0.75rem", fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
                    CREDITS
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* Outcomes */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-lg)", padding: "20px", boxShadow: "var(--shadow-premium)" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-subtle)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>Outcomes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {market.outcomes.map((outcome, idx) => {
                const totalBets = Number(market.totalPool);
                const pct = totalBets > 0 ? (Number(outcome.totalBetAmount) / totalBets) * 100 : 100 / market.outcomes.length;
                const colors = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];
                const color = colors[idx % colors.length];
                
                const signal = outcome.reputationSignal;
                return (
                  <div key={outcome.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, color: "var(--text-main)", fontSize: "0.95rem" }}>{outcome.label}</span>
                      <span style={{ fontWeight: 900, color: color, fontSize: "0.95rem" }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ background: "var(--bg-secondary)", height: 8, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ background: color, width: `${pct}%`, height: "100%", borderRadius: 10, transition: "width 1s" }} />
                    </div>
                    {signal != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: "0.72rem", color: "var(--text-subtle)", fontWeight: 600 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Expert signal: <span style={{ color: "#f59e0b", fontWeight: 800 }}>{Math.round(signal * 100)}%</span>
                        <span style={{ color: "var(--text-subtle)", fontWeight: 400, fontStyle: "italic" }}> — based on top predictors</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispute Section */}
          {isResolving && (
            <div style={{ background: "#fff9eb", border: "1.5px solid #fcd34d", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-premium)" }}>
              <div style={{ background: "#fef3c7", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#92400e", fontSize: "0.85rem", textTransform: "uppercase" }}>Dispute Window</div>
                  <div style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 700 }}>{disputeTimeLeft}</div>
                </div>
                <div style={{ fontSize: "1.5rem" }}>⚖️</div>
              </div>
              
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: "0.85rem", color: "#b45309", fontWeight: 600 }}>
                  Proposed: <strong style={{ color: "#b45309", fontSize: "1rem" }}>{proposedOutcome?.label ?? "Pending"}</strong>
                </div>
                
                {disputeSuccess ? (
                  <div style={{ background: "#ecfdf5", padding: "12px", borderRadius: 10, color: "#065f46", fontSize: "0.85rem", fontWeight: 700, textAlign: "center" }}>
                    ✅ Dispute Submitted
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input
                      type="number"
                      value={bondAmount}
                      onChange={(e) => setBondAmount(e.target.value)}
                      placeholder="Bond (Nu)"
                      style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #fde68a", fontSize: "0.9rem", fontWeight: 700, outline: "none" }}
                    />
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Reason (optional)"
                      rows={2}
                      style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #fde68a", fontSize: "0.9rem", outline: "none", resize: "none" }}
                    />
                    {disputeError && <div style={{ color: "#ef4444", fontSize: "0.75rem", fontWeight: 700 }}>{disputeError}</div>}
                    <button
                      onClick={handleSubmitDispute}
                      disabled={disputeSubmitting}
                      style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#f59e0b", color: "#fff", fontWeight: 900, border: "none" }}
                    >
                      {disputeSubmitting ? "SUBMITTING..." : "SUBMIT DISPUTE"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
};
