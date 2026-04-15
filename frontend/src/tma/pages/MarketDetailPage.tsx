import { FC, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import {
  getMarket,
  getMyBets,
  getDisputes,
  submitDispute,
  getDisputeRequirements,
  Market,
  Dispute,
  DisputeRequirements,
  Bet,
} from "@/api/client";
import { Link } from "@/tma/components/Link/Link";
import { ShareCTA } from "@/tma/components/ShareCTA";
import { useMarketSocket } from "@/tma/hooks/useMarketSocket";

export const MarketDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setDisputes] = useState<Dispute[]>([]);
  const [disputeReqs, setDisputeReqs] = useState<DisputeRequirements | null>(
    null,
  );
  const [bondAmount, setBondAmount] = useState("10");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeSuccess, setDisputeSuccess] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [userBets, setUserBets] = useState<Bet[]>([]);

  // ── Live WebSocket updates ─────────────────────────────────────────────────
  const liveData = useMarketSocket(id);

  /**
   * Merge the latest WS snapshot on top of the REST-fetched market so that
   * totalPool and per-outcome probabilities update in real time without
   * a full page reload.
   */
  const liveMarket = useMemo<Market | null>(() => {
    if (!market) return null;
    if (!liveData) return market;
    return {
      ...market,
      totalPool: String(liveData.totalPool),
      outcomes: market.outcomes.map((o) => {
        const live = liveData.outcomes.find((lo) => lo.id === o.id);
        if (!live) return o;
        return {
          ...o,
          totalBetAmount: String(live.totalBetAmount),
          lmsrProbability: live.lmsrProbability ?? o.lmsrProbability,
          currentOdds: String(live.currentOdds),
        } as typeof o;
      }),
    };
  }, [market, liveData]);

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
    // Check if user has already bet on this market
    getMyBets()
      .then((bets) => {
        const marketBets = bets.filter((b) => b.marketId === id);
        setUserBets(marketBets);
        setHasBet(marketBets.length > 0);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id || !market || market.status !== "resolving") return;
    getDisputes(id)
      .then(setDisputes)
      .catch(() => {});
    getDisputeRequirements(id)
      .then((reqs) => {
        setDisputeReqs(reqs);
        setBondAmount(String(reqs.minBond));
      })
      .catch(() => {});
  }, [id, market?.status]);

  const handleSubmitDispute = async () => {
    if (!id) return;
    const amount = parseFloat(bondAmount);
    const minBond = disputeReqs?.minBond ?? 10;
    if (!amount || amount < minBond) {
      setDisputeError(`Minimum bond is Nu ${minBond}.`);
      return;
    }
    setDisputeSubmitting(true);
    setDisputeError(null);
    try {
      await submitDispute(id, {
        bondAmount: amount,
        reason: disputeReason || undefined,
      });
      setDisputeSuccess(true);
      getDisputes(id)
        .then(setDisputes)
        .catch(() => {});
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

  const isResolving = (liveMarket ?? market).status === "resolving";
  const isResolved =
    (liveMarket ?? market).status === "resolved" ||
    (liveMarket ?? market).status === "settled";
  // Use liveMarket for all display — falls back to REST data until first WS event
  const m = liveMarket ?? market;
  const resolvedOutcome =
    isResolved && m.resolvedOutcomeId
      ? m.outcomes.find((o) => o.id === m.resolvedOutcomeId)
      : null;

  const wonTotalPayout = userBets
    .filter(
      (b) =>
        b.status === "won" ||
        (isResolved && b.outcomeId === m.resolvedOutcomeId),
    )
    .reduce((sum, b) => sum + (b.payout || 0), 0);

  const hasWon = wonTotalPayout > 0;

  const proposedOutcome =
    isResolving && m.proposedOutcomeId
      ? m.outcomes.find((o) => o.id === m.proposedOutcomeId)
      : null;

  const disputeTimeLeft = (() => {
    if (!m.disputeDeadlineAt) return null;
    const diff = new Date(m.disputeDeadlineAt).getTime() - Date.now();
    if (diff <= 0) return "Dispute window closed";
    const h = Math.floor(diff / 3600000);
    const min = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${min}m remaining`;
  })();

  const isOpen = m.status === "open";

  return (
    <Page back={true}>
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
            gap: 24,
            position: "relative",
          }}
        >
          {/* Header Section */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              boxShadow: "var(--shadow-premium)",
              backdropFilter: "var(--glass-blur)",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "var(--text-subtle)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Market Details
            </div>
            <h1
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                color: "var(--text-main)",
                marginBottom: 12,
                lineHeight: 1.2,
                fontFamily: "var(--font-display)",
              }}
            >
              {m.title}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: isOpen
                    ? "#22c55e"
                    : isResolving
                      ? "#f59e0b"
                      : "var(--text-muted)",
                }}
              >
                {m.status.toUpperCase()}
              </div>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {liveData && isOpen && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "inline-block",
                      boxShadow: "0 0 0 2px rgba(34,197,94,0.3)",
                      animation: "livePulse 1.5s ease-in-out infinite",
                      flexShrink: 0,
                    }}
                  />
                )}
                Nu {Number(m.totalPool).toLocaleString()}
              </div>
            </div>
            {m.description && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  marginTop: 16,
                  fontWeight: 500,
                }}
              >
                {m.description}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              boxShadow: "var(--shadow-premium)",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "var(--text-subtle)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Created", date: m.createdAt },
                { label: "Opens", date: m.opensAt },
                { label: "Closes", date: m.closesAt },
                ...(m.resolvedAt
                  ? [{ label: "Resolved", date: m.resolvedAt }]
                  : []),
              ].map(({ label, date }) =>
                date ? (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "var(--text-subtle)",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        color: "var(--text-main)",
                      }}
                    >
                      {new Date(date).toLocaleString("en-BT", {
                        timeZone: "Asia/Thimphu",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          {/* Resolution Criteria */}
          {m.resolutionCriteria && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                boxShadow: "var(--shadow-premium)",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: "var(--text-subtle)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                How this resolves
              </div>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.55,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                {m.resolutionCriteria}
              </p>
            </div>
          )}

          {/* Resolved Winner Banner */}
          {resolvedOutcome && (
            <div
              style={{
                background: "#45be76ff",
                border: "1px solid #22c55e",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                boxShadow: "var(--shadow-premium)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#86efac"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    color: "#86efac",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Resolved
                </div>
                <div
                  style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fff" }}
                >
                  {resolvedOutcome.label}
                </div>
              </div>
            </div>
          )}

          {/* Share CTA for Winner */}
          {resolvedOutcome && hasWon && (
            <ShareCTA
              type="win"
              amount={wonTotalPayout}
              marketTitle={m.title}
            />
          )}

          {/* Dispute Section */}
          {isResolving && (
            <div
              style={{
                background: "#fff9eb",
                border: "1.5px solid #fcd34d",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                boxShadow: "var(--shadow-premium)",
              }}
            >
              <div
                style={{
                  background: "#fef3c7",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 900,
                      color: "#92400e",
                      fontSize: "0.85rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Dispute Window
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#b45309",
                      fontWeight: 700,
                    }}
                  >
                    {disputeTimeLeft}
                  </div>
                </div>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b45309"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v3" />
                  <path d="m3 9 2 2 2-2" />
                  <path d="m17 9 2 2 2-2" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 21v-6" />
                  <path d="M9 21h6" />
                </svg>
              </div>

              <div
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#b45309",
                    fontWeight: 600,
                  }}
                >
                  Proposed:{" "}
                  <strong style={{ color: "#b45309", fontSize: "1rem" }}>
                    {proposedOutcome?.label ?? "Pending"}
                  </strong>
                </div>

                {/* Ineligibility notice */}
                {disputeReqs && !disputeReqs.eligible && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fca5a5",
                      borderRadius: 10,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      {disputeReqs.reason}
                    </span>
                  </div>
                )}

                {disputeSuccess ? (
                  <div
                    style={{
                      background: "#ecfdf5",
                      padding: "12px",
                      borderRadius: 10,
                      color: "#065f46",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#065f46"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Dispute Submitted
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <input
                        type="number"
                        value={bondAmount}
                        onChange={(e) => setBondAmount(e.target.value)}
                        min={disputeReqs?.minBond ?? 10}
                        placeholder={`Bond (min Nu ${disputeReqs?.minBond ?? 10})`}
                        disabled={disputeReqs != null && !disputeReqs.eligible}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: 10,
                          border: "1.5px solid #fde68a",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      {disputeReqs && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#b45309",
                            fontWeight: 600,
                            marginTop: 4,
                          }}
                        >
                          Min bond: Nu {disputeReqs.minBond} · requires{" "}
                          {disputeReqs.minParticipants} participants
                        </div>
                      )}
                    </div>
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Reason (optional)"
                      rows={2}
                      disabled={disputeReqs != null && !disputeReqs.eligible}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 10,
                        border: "1.5px solid #fde68a",
                        fontSize: "0.9rem",
                        outline: "none",
                        resize: "none",
                      }}
                    />
                    {disputeError && (
                      <div
                        style={{
                          color: "#ef4444",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {disputeError}
                      </div>
                    )}
                    <button
                      onClick={handleSubmitDispute}
                      disabled={
                        disputeSubmitting ||
                        (disputeReqs != null && !disputeReqs.eligible)
                      }
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: 12,
                        background:
                          disputeReqs && !disputeReqs.eligible
                            ? "#d1d5db"
                            : "#f59e0b",
                        color: "#fff",
                        fontWeight: 900,
                        border: "none",
                        cursor:
                          disputeReqs && !disputeReqs.eligible
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {disputeSubmitting ? "SUBMITTING..." : "SUBMIT DISPUTE"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Outcomes — each row is the predict CTA */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              boxShadow: "var(--shadow-premium)",
            }}
          >
            <style>{`
              @keyframes shimmer-slide {
                0%   { transform: translateX(-100%); }
                100% { transform: translateX(250%); }
              }
              @keyframes livePulse {
                0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
                50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(34,197,94,0.1); }
              }
            `}</style>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: "var(--text-subtle)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Pick your outcome
              </div>
              {(() => {
                const meta = (m as any).signalMeta;
                if (!meta || meta.composite === 0) return null;
                const c = meta.composite as number;
                const pct = Math.round(c * 100);
                // colour: red < 30, amber 30-60, green > 60
                const col =
                  c >= 0.6 ? "#22c55e" : c >= 0.3 ? "#f59e0b" : "#ef4444";
                const label = c >= 0.6 ? "High" : c >= 0.3 ? "Moderate" : "Low";
                // Arc SVG: r=7, cx=cy=9, circumference≈43.98, filled portion = pct/100 * 43.98
                const r = 7,
                  circ = 2 * Math.PI * r;
                const dash = (c * circ).toFixed(2);
                return (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                    title={`Participants: ${meta.participantCount} · Reputation depth: ${Math.round(meta.reputationDepth * 100)}% · Maturity: ${Math.round(meta.maturityScore * 100)}%`}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <circle
                        cx="9"
                        cy="9"
                        r={r}
                        fill="none"
                        stroke="var(--bg-secondary)"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="9"
                        cy="9"
                        r={r}
                        fill="none"
                        stroke={col}
                        strokeWidth="2.5"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        transform="rotate(-90 9 9)"
                      />
                    </svg>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        color: col,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {label} confidence · {pct}%
                    </span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {m.outcomes.map((outcome, idx) => {
                const totalBets = Number(m.totalPool);
                const pct =
                  hasBet &&
                  outcome.intelligenceProb != null &&
                  outcome.intelligenceProb > 0
                    ? outcome.intelligenceProb * 100
                    : outcome.lmsrProbability != null &&
                        outcome.lmsrProbability > 0
                      ? outcome.lmsrProbability * 100
                      : totalBets > 0
                        ? (Number(outcome.totalBetAmount) / totalBets) * 100
                        : 100 / m.outcomes.length;
                // Raw LMSR for delta display (crowd money) — only relevant post-bet
                const rawPct =
                  hasBet &&
                  outcome.lmsrProbability != null &&
                  outcome.lmsrProbability > 0
                    ? outcome.lmsrProbability * 100
                    : null;
                const delta =
                  hasBet && outcome.intelligenceProb != null && rawPct != null
                    ? Math.round(outcome.intelligenceProb * 100) -
                      Math.round(rawPct)
                    : null;
                const colors = [
                  "#22c55e",
                  "#ef4444",
                  "#f59e0b",
                  "#3b82f6",
                  "#8b5cf6",
                ];
                const color = colors[idx % colors.length];
                const signal = outcome.reputationSignal;
                const barWidth = Math.max(4, Math.min(100, pct));
                return (
                  <Link
                    key={outcome.id}
                    to={
                      isOpen
                        ? `/dkbank-bet/${m.id}?outcomeId=${outcome.id}`
                        : "#"
                    }
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 14,
                        overflow: "hidden",
                        background: "var(--bg-secondary)",
                        border: `1.5px solid ${color}30`,
                        boxShadow: `0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px ${color}18`,
                        cursor: isOpen ? "pointer" : "default",
                        transition:
                          "transform 0.12s ease, box-shadow 0.15s ease",
                      }}
                      onMouseDown={(e) => {
                        if (!isOpen) return;
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "scale(0.982)";
                        el.style.boxShadow = `inset 3px 3px 8px rgba(0,0,0,0.28), inset 0 0 0 1px ${color}50`;
                      }}
                      onMouseUp={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "scale(1)";
                        el.style.boxShadow = `0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px ${color}18`;
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.transform = "scale(1)";
                        el.style.boxShadow = `0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px ${color}18`;
                      }}
                    >
                      {/* probability fill */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: `${barWidth}%`,
                          background: `linear-gradient(90deg, ${color}55 0%, ${color}28 60%, transparent 100%)`,
                          borderRadius: "14px 0 0 14px",
                          transition: "width 1s ease",
                          pointerEvents: "none",
                        }}
                      />

                      {/* shimmer sweep — only on open markets */}
                      {isOpen && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            overflow: "hidden",
                            borderRadius: 14,
                            pointerEvents: "none",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              bottom: 0,
                              width: "40%",
                              background: `linear-gradient(90deg, transparent, ${color}18, transparent)`,
                              animation:
                                "shimmer-slide 2.4s ease-in-out infinite",
                            }}
                          />
                        </div>
                      )}

                      {/* content */}
                      <div
                        style={{
                          position: "relative",
                          padding: "13px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.92rem",
                              fontWeight: 800,
                              color: "var(--text-main)",
                              letterSpacing: "-0.01em",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {outcome.label}
                          </span>
                          {signal != null && hasBet && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                color: "#f59e0b",
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}
                            >
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 24 24"
                                fill="#f59e0b"
                                stroke="none"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Experts {Math.round(signal * 100)}%
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          {delta !== null && delta !== 0 && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                color: delta > 0 ? "#22c55e" : "#ef4444",
                              }}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}%
                            </span>
                          )}
                          <div
                            style={{
                              background: `${color}22`,
                              border: `1.5px solid ${color}50`,
                              color: color,
                              fontSize: "1rem",
                              fontWeight: 900,
                              padding: "4px 14px",
                              borderRadius: 99,
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {pct.toFixed(0)}%
                          </div>
                          {isOpen && (
                            <div
                              style={{
                                background: color,
                                color: "#fff",
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                padding: "4px 10px",
                                borderRadius: 99,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              Predict
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};
