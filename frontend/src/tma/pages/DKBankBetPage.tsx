import { FC, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Section,
  Cell,
  List,
  Spinner,
  Placeholder,
  Button,
  Input,
  Caption,
  Title,
} from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarket, placeBet, Market } from "@/api/client";
import { initiateDKBankPayment, formatBTN } from "@/api/dkbank";
import { useAuth } from "@/tma/hooks/useAuth";
import config from "@/config";

export const DKBankBetPage: FC = () => {
  const { id } = useParams<{ id: string }>();

  const { user } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("0.5");
  const [maxShares, setMaxShares] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"select" | "payment">("select");

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

  const handlePayWithDKBank = async () => {
    if (!selectedOutcomeId || !amount || !market) return;

    setProcessing(true);
    try {
      const btnAmount = parseFloat(amount);
      const isSCPM = market.mechanism === "scpm";

      // Validation
      if (btnAmount < config.payments.dkBank.minBet) {
        throw new Error(`Minimum bet is ${config.payments.dkBank.minBet} BTN`);
      }

      // Step 1: Initiate DK Bank payment
      const result = await initiateDKBankPayment({
        amount: btnAmount,
        merchantTxnId: `TARA_${market.id}_${Date.now()}`,
        customerPhone: "+975XXXXXXXX",
        description: `Bet on: ${market.title}`,
      });

      if (result.success) {
        // Step 2: Register the bet
        if (user) {
          try {
            await placeBet(market.id, {
              outcomeId: selectedOutcomeId,
              amount: btnAmount,
              maxShares: isSCPM ? parseFloat(maxShares) : undefined,
              limitPrice: isSCPM ? parseFloat(limitPrice) : undefined,
            });
          } catch (betErr: any) {
            console.warn("Bet registration warning:", betErr.message);
          }
        }

        alert(`✅ ${result.message}\n\nTransaction ID: ${result.txnId}`);

        const updated = await getMarket(market.id);
        setMarket(updated);
        setAmount("");
        setMaxShares("");
        setSelectedOutcomeId(null);
        setStep("select");
      } else {
        throw new Error(result.message || "Payment failed");
      }
    } catch (err: any) {
      alert("❌ Failed: " + err.message);
    } finally {
      setProcessing(false);
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

  const canBet = market.status === "open";
  const { dkBank } = config.payments;

  // Calculate potential payout
  const selectedOutcome = market.outcomes.find(
    (o) => o.id === selectedOutcomeId,
  );
  const betAmount = parseFloat(amount) || 0;

  // Calculate potential payout based on parimutuel odds
  let potentialPayout = 0;
  if (selectedOutcome && betAmount > 0) {
    const currentPool = Number(market.totalPool);
    const outcomePool = Number(selectedOutcome.totalBetAmount);
    const newOutcomePool = outcomePool + betAmount;
    const newTotalPool = currentPool + betAmount;

    // Parimutuel payout = (bet amount / outcome pool) * total pool * (1 - fee)
    if (newOutcomePool > 0) {
      potentialPayout = (betAmount / newOutcomePool) * newTotalPool;
    }
  }

  const profit = potentialPayout - betAmount;

  return (
    <Page back={true}>
      <List>
        {/* Market info */}
        <Section header="Match">
          <div style={{ padding: "1rem" }}>
            <Title level="2" weight="1">
              {market.title}
            </Title>
            <Caption
              level="2"
              style={{ marginTop: "0.5rem", display: "block" }}
            >
              Total Pool: <strong>{formatBTN(Number(market.totalPool))}</strong>
            </Caption>
          </div>
        </Section>

        {/* Outcomes - Step 1: Select outcome and see odds */}
        {canBet && step === "select" && (
          <Section header="Pick Outcome">
            {market.outcomes.map((outcome) => {
              const isSelected = selectedOutcomeId === outcome.id;
              const outcomePool = Number(outcome.totalBetAmount);

              // Use LMSR probability if available, fallback to parimutuel calculation
              const lmsrProb = Number(outcome.lmsrProbability || 0);
              const probability = lmsrProb > 0 ? lmsrProb : 0.5; // Fallback to 50% if not set
              const probabilityPercent = (probability * 100).toFixed(1);

              // Calculate decimal odds from probability (1 / probability)
              const decimalOdds =
                probability > 0 ? (1 / probability).toFixed(2) : "—";

              return (
                <Cell
                  key={outcome.id}
                  onClick={() => setSelectedOutcomeId(outcome.id)}
                  subtitle={`${probabilityPercent}% · ${formatBTN(outcomePool)} pool`}
                  after={
                    <Caption level="1" style={{ fontWeight: "600" }}>
                      {decimalOdds}x
                    </Caption>
                  }
                  style={{
                    backgroundColor: isSelected
                      ? "rgba(0, 122, 255, 0.15)"
                      : undefined,
                    cursor: "pointer",
                    border: isSelected ? "2px solid #007AFF" : undefined,
                  }}
                >
                  <strong>{outcome.label}</strong>
                </Cell>
              );
            })}
          </Section>
        )}

        {/* Bet amount input - Step 2: Enter amount and see potential payout */}
        {canBet && selectedOutcome && step === "select" && (
          <Section header="Enter Amount">
            <div style={{ padding: "1rem" }}>
              {market.mechanism === "scpm" ? (
                <>
                  <Input
                    header="Max Shares to Fill"
                    placeholder="e.g. 20"
                    type="number"
                    value={maxShares}
                    onChange={(e) => setMaxShares(e.target.value)}
                    style={{ marginBottom: "1rem" }}
                  />
                  <Input
                    header="Limit Price (Implied Prob)"
                    placeholder="0.45"
                    type="number"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    style={{ marginBottom: "1rem" }}
                  />
                  <Input
                    header={`Budget in ${dkBank.currency} (Max Cost)`}
                    placeholder={`Min ${dkBank.minBet}`}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ marginBottom: "1rem" }}
                  />
                </>
              ) : (
                <Input
                  header={`Amount in ${dkBank.currency}`}
                  placeholder={`Min ${dkBank.minBet}`}
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ marginBottom: "1rem", fontSize: "1.2rem" }}
                />
              )}

              {/* Quick amount buttons */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                {[dkBank.minBet, 50, 100, 200, 500, 1000].map((quickAmount) => (
                  <button
                    key={quickAmount}
                    onClick={() => setAmount(quickAmount.toString())}
                    style={{
                      padding: "0.6rem",
                      background:
                        amount === quickAmount.toString()
                          ? "#007AFF"
                          : "rgba(0, 122, 255, 0.1)",
                      color:
                        amount === quickAmount.toString() ? "white" : "#007AFF",
                      border: "1px solid #007AFF",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {quickAmount}
                  </button>
                ))}
              </div>

              {/* Increment buttons */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <button
                  onClick={() => {
                    const current = parseFloat(amount) || 0;
                    setAmount((current + dkBank.minBet).toString());
                  }}
                  style={{
                    padding: "0.6rem",
                    background: "rgba(76, 175, 80, 0.1)",
                    color: "#4CAF50",
                    border: "1px solid #4CAF50",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  +{dkBank.minBet}
                </button>
                <button
                  onClick={() => {
                    const current = parseFloat(amount) || 0;
                    setAmount((current + 50).toString());
                  }}
                  style={{
                    padding: "0.6rem",
                    background: "rgba(76, 175, 80, 0.1)",
                    color: "#4CAF50",
                    border: "1px solid #4CAF50",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  +50
                </button>
                <button
                  onClick={() => {
                    const current = parseFloat(amount) || 0;
                    setAmount((current + 100).toString());
                  }}
                  style={{
                    padding: "0.6rem",
                    background: "rgba(76, 175, 80, 0.1)",
                    color: "#4CAF50",
                    border: "1px solid #4CAF50",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  +100
                </button>
              </div>

              {betAmount >= dkBank.minBet && (
                <div
                  style={{
                    background: "rgba(76, 175, 80, 0.1)",
                    border: "1px solid rgba(76, 175, 80, 0.3)",
                    borderRadius: "12px",
                    padding: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Caption level="1">Your bet:</Caption>
                    <Caption level="1" weight="1">
                      {formatBTN(betAmount)}
                    </Caption>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Caption level="1">Potential payout:</Caption>
                    <Caption level="1" weight="1" style={{ color: "#4CAF50" }}>
                      {formatBTN(potentialPayout)}
                    </Caption>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid rgba(76, 175, 80, 0.2)",
                      paddingTop: "0.5rem",
                    }}
                  >
                    <Caption level="1" weight="2">
                      Potential profit:
                    </Caption>
                    <Caption level="1" weight="2" style={{ color: "#4CAF50" }}>
                      +{formatBTN(profit)}
                    </Caption>
                  </div>
                </div>
              )}

              <Button
                size="l"
                stretched
                disabled={!betAmount || betAmount < dkBank.minBet}
                onClick={() => setStep("payment")}
              >
                Continue to Payment
              </Button>
            </div>
          </Section>
        )}

        {/* Payment details - Step 3: Enter phone and confirm */}
        {canBet && step === "payment" && selectedOutcome && (
          <>
            <Section header="Bet Summary">
              <div style={{ padding: "1rem" }}>
                <div
                  style={{
                    background: "rgba(0, 122, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <Caption level="2" style={{ marginBottom: "0.5rem" }}>
                    Betting on:
                  </Caption>
                  <Title level="3" weight="2">
                    {selectedOutcome.label}
                  </Title>
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <Caption level="2">Amount:</Caption>
                      <Caption level="1" weight="1">
                        {formatBTN(betAmount)}
                      </Caption>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Caption level="2">Potential win:</Caption>
                      <Caption
                        level="1"
                        weight="1"
                        style={{ color: "#4CAF50" }}
                      >
                        {formatBTN(potentialPayout)}
                      </Caption>
                    </div>
                  </div>
                </div>
                <Button
                  mode="outline"
                  size="s"
                  stretched
                  onClick={() => setStep("select")}
                  style={{ marginBottom: "1rem" }}
                >
                  ← Change Selection
                </Button>
              </div>
            </Section>

            <Section header="Payment via DK Bank">
              <Cell before={<span style={{ fontSize: "2rem" }}></span>}>
                <strong>Digital Kidu Mobile Banking</strong>
              </Cell>
            </Section>

            <Section>
              <div style={{ padding: "1rem" }}>
                <Button
                  size="l"
                  stretched
                  loading={processing}
                  onClick={handlePayWithDKBank}
                >
                  {processing
                    ? "Processing..."
                    : `Pay ${formatBTN(betAmount)} BTN`}
                </Button>
              </div>
            </Section>
          </>
        )}

        {!canBet && (
          <Section>
            <Placeholder
              header={
                market.status === "upcoming"
                  ? "Match Not Started"
                  : "Betting Closed"
              }
              description={
                market.status === "upcoming"
                  ? "This match will open soon"
                  : "Betting is no longer available"
              }
            />
          </Section>
        )}
      </List>
    </Page>
  );
};
