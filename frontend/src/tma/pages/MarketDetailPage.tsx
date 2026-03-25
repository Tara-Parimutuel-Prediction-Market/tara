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
import { getMarket, Market } from "@/api/client";
import { useAuth } from "@/tma/hooks/useAuth";
import { Link } from "@/tma/components/Link/Link";

export const MarketDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(
    null,
  );

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

        {market.status !== "open" && (
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
