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
  const [disputes, setDisputes] = useState<Dispute[]>([]);
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
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: bp === "mobile" ? "16px 12px 80px" : "20px 16px" }}>
      <Link
        to="/"
        style={{
          color: "#3b82f6",
          textDecoration: "none",
          fontSize: "0.9rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          marginBottom: "20px",
        }}
      >
        ← Back to Markets
      </Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div>
          <h1
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "8px",
            }}
          >
            {market.title}
          </h1>
          {market.mechanism === "scpm" && (
            <span style={{ fontSize: "0.7rem", color: "#3b82f6", fontWeight: 700, border: "1px solid #3b82f6", padding: "2px 6px", borderRadius: "100px" }}>
              SCPM / LMSR
            </span>
          )}
        </div>
      </div>

      {market.description && (
        <p
          style={{
            color: "#9ca3af",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            marginTop: "12px",
            marginBottom: "20px",
          }}
        >
          {market.description}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: bp === "mobile" ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(120px, 1fr))",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              color: "#9ca3af",
              fontSize: "0.75rem",
              marginBottom: "4px",
            }}
          >
            STATUS
          </div>
          <div style={{ color: isOpen ? "#4CAF50" : isResolving ? "#f59e0b" : "#9ca3af", fontWeight: 700 }}>
            {market.status.toUpperCase()}
          </div>
        </div>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              color: "#9ca3af",
              fontSize: "0.75rem",
              marginBottom: "4px",
            }}
          >
            TOTAL POOL
          </div>
          <div style={{ color: "#111827", fontWeight: 700 }}>
             {market.totalPool}
          </div>
        </div>
        {market.closesAt && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                color: "#9ca3af",
                fontSize: "0.75rem",
                marginBottom: "4px",
              }}
            >
              CLOSES
            </div>
            <div style={{ color: "#111827", fontWeight: 700 }}>
              {new Date(market.closesAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>

      {/* Crowd sentiment */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", marginBottom: "10px" }}>
          CROWD SENTIMENT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {market.outcomes.map((outcome) => {
            const pct = totalBets > 0
              ? (parseFloat(outcome.totalBetAmount) / totalBets) * 100
              : 100 / market.outcomes.length;
            return (
              <div key={outcome.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{outcome.label}</span>
                  <span style={{ color: "#9ca3af" }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ background: "#f3f4f6", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                  <div style={{ background: "#3b82f6", height: "100%", width: `${pct}%`, borderRadius: "4px", transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isOpen ? (
        <PwaBetForm market={market} onBetPlaced={refreshMarket} />
      ) : isResolving ? (
        <div style={{ border: "1px solid #f59e0b", borderRadius: "12px", overflow: "hidden" }}>
          {/* Header */}
          <div style={{ background: "#fef3c7", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.95rem" }}>Dispute Window Open</div>
              <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "2px" }}>{disputeTimeLeft}</div>
            </div>
            <div style={{ fontSize: "1.5rem" }}>⚖️</div>
          </div>
          {/* Proposed outcome */}
          <div style={{ padding: "16px", background: "#fff" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", marginBottom: "8px" }}>PROPOSED OUTCOME</div>
            {proposedOutcome ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 14px" }}>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>{proposedOutcome.label}</span>
              </div>
            ) : (
              <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Outcome pending</div>
            )}
            <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#6b7280" }}>
              {disputes.length} dispute{disputes.length !== 1 ? "s" : ""} submitted
            </div>
          </div>
          {/* Dispute form */}
          <div style={{ padding: "16px", borderTop: "1px solid #f3f4f6", background: "#fafafa" }}>
            {disputeSuccess ? (
              <div style={{ textAlign: "center", padding: "12px", color: "#16a34a", fontWeight: 600, fontSize: "0.9rem" }}>
                Dispute submitted. Your bond will be refunded after resolution.
              </div>
            ) : (
              <>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "10px" }}>
                  Disagree with the proposed outcome?
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ fontSize: "0.75rem", color: "#6b7280", display: "block", marginBottom: "4px" }}>Bond Amount (credits)</label>
                  <input
                    type="number"
                    min="1"
                    value={bondAmount}
                    onChange={(e) => setBondAmount(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e5e7eb", fontSize: "0.9rem", outline: "none" }}
                  />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "0.75rem", color: "#6b7280", display: "block", marginBottom: "4px" }}>Reason (optional)</label>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={2}
                    placeholder="Why do you think this outcome is wrong?"
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e5e7eb", fontSize: "0.85rem", outline: "none", resize: "none", fontFamily: "inherit" }}
                  />
                </div>
                {disputeError && <div style={{ color: "#dc2626", fontSize: "0.8rem", marginBottom: "8px" }}>{disputeError}</div>}
                <button
                  onClick={handleSubmitDispute}
                  disabled={disputeSubmitting}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: disputeSubmitting ? "#d1d5db" : "#f59e0b", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: disputeSubmitting ? "not-allowed" : "pointer" }}
                >
                  {disputeSubmitting ? "Submitting…" : "Submit Dispute"}
                </button>
                <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: "8px", textAlign: "center" }}>
                  Bond is always refunded after admin makes the final call.
                </div>
              </>
            )}
          </div>
        </div>
      ) : market.status === "upcoming" ? (
        <div
          style={{
            background: "linear-gradient(135deg, #eff6ff, #ffffff)",
            border: "1px solid #3b82f644",
            borderRadius: "16px",
            padding: "32px 20px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "16px" }}>🕒</div>
          <div style={{ fontWeight: 700, color: "#111827", fontSize: "1.1rem", marginBottom: "8px" }}>
            Market Starts Soon
          </div>
          <div style={{ color: "#9ca3af", fontSize: "0.9rem", maxWidth: "300px", margin: "0 auto" }}>
            This market opens for betting on{" "}
            <strong style={{ color: "#3b82f6" }}>
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
            background: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 700, color: "#9ca3af", marginBottom: "8px" }}>
            Betting is closed
          </div>
          <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
            This market has closed and is no longer accepting new bets.
          </div>
        </div>
      )}

      {/* Keep the Telegram option but as a secondary choice */}
      <div style={{ marginTop: "32px", textAlign: "center", borderTop: "1px solid #e5e7eb", paddingTop: "24px" }}>
        <div style={{ color: "#9ca3af", fontSize: "0.85rem", marginBottom: "12px" }}>
          Other ways to bet:
        </div>
        <a
          href={`https://t.me/Tara_parimutuel_bot/app?startapp=market_${market.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#3b82f6",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: 600
          }}
        >
           Open in Telegram Mini App
        </a>
      </div>
    </div>
  );
}
