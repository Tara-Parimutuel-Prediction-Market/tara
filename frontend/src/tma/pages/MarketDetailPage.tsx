import { FC, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Section,
  Cell,
  List,
  Spinner,
  Placeholder,
  Caption,
  Title,
} from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarket, getDisputes, submitDispute, Market, Dispute } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { Link } from "@/tma/components/Link/Link";

export const MarketDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
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

  const canBet = market.status === "open" && user;
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

  return (
    <Page back={true}>
      <List>
        <Section
          header="Market Details"
          footer={`House edge: ${market.houseEdgePct}% · Total pool: ${market.totalPool}`}
        >
          <div style={{ padding: "1rem" }}>
            <Title level="2" weight="1">
              {market.title}
            </Title>
            <Caption
              level="2"
              style={{ marginTop: "0.5rem", display: "block" }}
            >
              Status: <strong>{market.status.toUpperCase()}</strong>
            </Caption>
            {market.opensAt && (
              <Caption level="2" style={{ display: "block" }}>
                Opens: {new Date(market.opensAt).toLocaleString()}
              </Caption>
            )}
            {market.closesAt && (
              <Caption level="2" style={{ display: "block" }}>
                Closes: {new Date(market.closesAt).toLocaleString()}
              </Caption>
            )}
          </div>
        </Section>

        {/* Payment Options - Show when market is open */}
        {market.status === "open" && (
          <Section header="Choose Payment Method">
            <div
              style={{
                padding: "1rem",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
              }}
            >
              <Link to={`/dkbank-bet/${market.id}`}>
                <button
                  style={{
                    width: "100%",
                    padding: "1rem 0.5rem",
                    background: "#FF6B35",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}></span>
                  <span>DK Bank</span>
                </button>
              </Link>
              <Link to={`/ton-bet/${market.id}`}>
                <button
                  style={{
                    width: "100%",
                    padding: "1rem 0.5rem",
                    background: "#0098EA",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}></span>
                  <span>TON</span>
                </button>
              </Link>
              <Link to={`/market/${market.id}`}>
                <button
                  style={{
                    width: "100%",
                    padding: "1rem 0.5rem",
                    background: "#007AFF",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}></span>
                  <span>Credits</span>
                </button>
              </Link>
            </div>
          </Section>
        )}

        <Section header="Outcomes">
          {market.outcomes.map((outcome) => {
            const isSelected = selectedOutcomeId === outcome.id;

            // Use LMSR probability if available, fallback to parimutuel calculation
            const lmsrProb = Number(outcome.lmsrProbability || 0);
            const probability =
              lmsrProb > 0
                ? lmsrProb
                : Number(market.totalPool) > 0
                  ? Number(outcome.totalBetAmount) / Number(market.totalPool)
                  : 0.5;
            const probabilityPercent = (probability * 100).toFixed(1);

            // Calculate decimal odds from probability
            const decimalOdds =
              probability > 0 ? (1 / probability).toFixed(2) : "—";

            return (
              <Cell
                key={outcome.id}
                onClick={() => canBet && setSelectedOutcomeId(outcome.id)}
                subtitle={`${probabilityPercent}% · ${decimalOdds}x odds`}
                after={
                  outcome.isWinner ? (
                    <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
                      ✓ Winner
                    </span>
                  ) : canBet ? (
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => setSelectedOutcomeId(outcome.id)}
                    />
                  ) : null
                }
                style={{
                  backgroundColor: isSelected
                    ? "rgba(0, 122, 255, 0.1)"
                    : undefined,
                  cursor: canBet ? "pointer" : "default",
                }}
              >
                {outcome.label}
              </Cell>
            );
          })}
        </Section>

        {isResolving && (
          <Section header={`Dispute Window — ${disputeTimeLeft ?? ""}`}>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
                Proposed outcome:{" "}
                <strong style={{ color: "#16a34a" }}>
                  {proposedOutcome?.label ?? "Pending"}
                </strong>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
                {disputes.length} dispute{disputes.length !== 1 ? "s" : ""} submitted
              </div>
              {disputeSuccess ? (
                <div style={{ color: "#16a34a", fontWeight: 600, fontSize: 13, padding: "10px 0" }}>
                  Dispute submitted. Bond will be refunded after resolution.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      Bond Amount (credits)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={bondAmount}
                      onChange={(e) => setBondAmount(e.target.value)}
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none" }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      Reason (optional)
                    </label>
                    <textarea
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      rows={2}
                      placeholder="Why do you think this outcome is wrong?"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit" }}
                    />
                  </div>
                  {disputeError && (
                    <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{disputeError}</div>
                  )}
                  <button
                    onClick={handleSubmitDispute}
                    disabled={disputeSubmitting}
                    style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: disputeSubmitting ? "#d1d5db" : "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 14, cursor: disputeSubmitting ? "not-allowed" : "pointer" }}
                  >
                    {disputeSubmitting ? "Submitting…" : "Submit Dispute"}
                  </button>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, textAlign: "center" }}>
                    Bond is always refunded after admin makes the final call.
                  </div>
                </>
              )}
            </div>
          </Section>
        )}

        {market.status !== "open" && !isResolving && (
          <Section>
            <Placeholder
              header={
                market.status === "upcoming" ? "Not Open Yet" : "Betting Closed"
              }
              description={
                market.status === "upcoming"
                  ? "This market will open soon"
                  : market.status === "resolved" || market.status === "settled"
                    ? "This market has been resolved"
                    : "Betting is no longer available"
              }
            />
          </Section>
        )}
      </List>
    </Page>
  );
};
