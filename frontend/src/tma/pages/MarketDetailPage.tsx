import { FC, useEffect, useState } from "react";
import dkBankLogo from "../../../assets/dk blue.png";
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

  const isResolving = market.status === "resolving";
  const isResolved =
    market.status === "resolved" || market.status === "settled";
  const resolvedOutcome =
    isResolved && market.resolvedOutcomeId
      ? market.outcomes.find((o) => o.id === market.resolvedOutcomeId)
      : null;

  const wonTotalPayout = userBets
    .filter((b) => b.status === "won" || (isResolved && b.outcomeId === market.resolvedOutcomeId))
    .reduce((sum, b) => sum + (b.payout || 0), 0);
  
  const hasWon = wonTotalPayout > 0;

  const proposedOutcome =
    isResolving && market.proposedOutcomeId
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
              {market.title}
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
                {market.status.toUpperCase()}
              </div>
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                }}
              >
                Nu {Number(market.totalPool).toLocaleString()}
              </div>
            </div>
            {market.description && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  marginTop: 16,
                  fontWeight: 500,
                }}
              >
                {market.description}
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
                { label: "Created", date: market.createdAt },
                { label: "Opens", date: market.opensAt },
                { label: "Closes", date: market.closesAt },
                ...(market.resolvedAt
                  ? [{ label: "Resolved", date: market.resolvedAt }]
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
          {market.resolutionCriteria && (
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
                {market.resolutionCriteria}
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
            <ShareCTA type="win" amount={wonTotalPayout} marketTitle={market.title} />
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

          {/* Betting Options */}
          {isOpen && (
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
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: "var(--text-subtle)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                Payment Method
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                <Link
                  to={`/dkbank-bet/${market.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <button
                    style={{
                      width: "100%",
                      padding: "12px 8px",
                      background: "#fff",
                      border: "2px solid #ff8c00",
                      borderRadius: 12,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(255,140,0,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={dkBankLogo}
                      alt="DK Bank"
                      style={{ height: 18, width: "auto" }}
                    />
                  </button>
                </Link>
                <Link
                  to={`/ton-bet/${market.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <button
                    style={{
                      width: "100%",
                      padding: "16px 8px",
                      background: "linear-gradient(135deg, #00b4ed, #0072bc)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(0,180,237,0.3)",
                    }}
                  >
                    TON
                  </button>
                </Link>
                <Link
                  to={`/market/${market.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <button
                    style={{
                      width: "100%",
                      padding: "16px 8px",
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
                    }}
                  >
                    CREDITS
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* Outcomes */}
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
                Outcomes
              </div>
              {(() => {
                const meta = (market as any).signalMeta;
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
              {market.outcomes.map((outcome, idx) => {
                const totalBets = Number(market.totalPool);
                // After betting: prefer intelligence-weighted prob, then LMSR.
                // Before betting: use LMSR (avoids 0%/100% on single-bettor markets).
                // Raw parimutuel ratio is only a last resort when no LMSR is stored.
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
                        : 100 / market.outcomes.length;
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
                return (
                  <div key={outcome.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 800,
                          color: "var(--text-main)",
                          fontSize: "0.95rem",
                        }}
                      >
                        {outcome.label}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
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
                        <span
                          style={{
                            fontWeight: 900,
                            color: color,
                            fontSize: "0.95rem",
                          }}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        height: 8,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          background: color,
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: 10,
                          transition: "width 1s",
                        }}
                      />
                    </div>
                    {signal != null && hasBet && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 5,
                          fontSize: "0.72rem",
                          color: "var(--text-subtle)",
                          fontWeight: 600,
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="#f59e0b"
                          stroke="none"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Top predictors lean {outcome.label} ·{" "}
                        <span style={{ color: "#f59e0b", fontWeight: 800 }}>
                          {Math.round(signal * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};
