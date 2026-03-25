import { FC, useState } from "react";
import {
  useTonWallet,
  useTonConnectUI,
  TonConnectButton,
} from "@tonconnect/ui-react";
import { Market, placeBetWithWallet } from "@/api/client";
import { PwaPaymentSelector } from "./PwaPaymentSelector";

interface PwaBetFormProps {
  market: Market;
  onBetPlaced?: (updatedMarket?: Market) => void;
}

export const PwaBetForm: FC<PwaBetFormProps> = ({ market, onBetPlaced }) => {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("0.5");
  const [maxShares, setMaxShares] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [cidNumber, setCidNumber] = useState("");

  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const isSCPM = String(market.mechanism || "").toLowerCase().includes("scpm") || 
                 market.title.toLowerCase().includes("btc");

  const handlePaymentSuccess = async (paymentMethod: string) => {
    // Payment successful, now place bet
    await placeBetAfterPayment(paymentMethod);
  };

  const handlePaymentFailure = (error: string) => {
    setLoading(false);
    setShowPaymentSelector(false);
    alert(`Payment failed: ${error}`);
  };

  const placeBetAfterPayment = async (paymentMethod: string) => {
    if (!selectedOutcomeId || !amount) return;

    try {
      const betAmount = parseFloat(amount || "0");
      if (betAmount <= 0) throw new Error("Amount must be positive");

      if (paymentMethod === 'ton') {
        // TON payment flow - requires wallet connection
        if (!wallet) {
          throw new Error("TON wallet required for TON payments");
        }

        const PLATFORM_WALLET = "EQD..."; 
        const nanoAmount = (betAmount * 1_000_000_000).toString();

        const tx = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 600,
          messages: [
            {
              address: PLATFORM_WALLET,
              amount: nanoAmount,
              payload: btoa(`bet:${market.id}:${selectedOutcomeId}`),
            },
          ],
        });

        await placeBetWithWallet(market.id, {
          outcomeId: selectedOutcomeId,
          amount: betAmount,
          walletAddress: wallet.account.address,
          txHash: tx.boc,
        });
      } else {
        // DK Bank or Credits payment flow (demo for now)
        const updatedMarket = { ...market };
        updatedMarket.totalPool = (Number(market.totalPool || 0) + betAmount).toString();
        
        updatedMarket.outcomes = market.outcomes.map(o => {
          if (o.id === selectedOutcomeId) {
            const newAmount = Number(o.totalBetAmount || 0) + betAmount;
            let newProb = Number(o.lmsrProbability || 0);
            if (isSCPM) {
              const b = Number(market.liquidityParam || 1000);
              newProb = Math.min(0.99, newProb + (betAmount / b) * (1 - newProb));
            } else {
              newProb = newAmount / Number(updatedMarket.totalPool || 1);
            }

            return { 
              ...o, 
              totalBetAmount: newAmount.toString(),
              lmsrProbability: newProb
            };
          } else {
            let newProb = Number(o.lmsrProbability || 0);
            if (isSCPM) {
              const b = Number(market.liquidityParam || 1000);
              newProb = Math.max(0.01, newProb - (betAmount / b) * newProb);
            } else {
              newProb = Number(o.totalBetAmount || 0) / Number(updatedMarket.totalPool || 1);
            }
            return { ...o, lmsrProbability: newProb };
          }
        });

        await new Promise(resolve => setTimeout(resolve, 800));
        if (onBetPlaced) onBetPlaced(updatedMarket);
      }

      // Reset form
      setSelectedOutcomeId(null);
      setAmount("");
      setBetAmount(0);
      setShowPaymentSelector(false);
    } catch (error: any) {
      alert(`Bet placement failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedOutcomeId || !amount) return;

    const betAmount = parseFloat(amount || "0");
    if (betAmount <= 0) {
      alert("Please enter a valid bet amount");
      return;
    }

    setBetAmount(betAmount);
    setShowPaymentSelector(true);
  };

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: "1rem", color: "#6ab3f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Place a Bet</span>
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Outcome Selector */}
        <div style={fieldStyle}>
          <label style={labelStyle}>SELECT OUTCOME</label>
          <select 
            value={selectedOutcomeId || ""} 
            onChange={(e) => setSelectedOutcomeId(e.target.value)}
            style={inputStyle}
          >
            <option value="" disabled>Choose an outcome...</option>
            {market.outcomes.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>

        {isSCPM ? (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>MAX SHARES</label>
              <input 
                type="number" 
                placeholder="20" 
                value={maxShares} 
                onChange={(e) => setMaxShares(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>LIMIT PRICE (0.01 - 0.99)</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="0.45" 
                value={limitPrice} 
                onChange={(e) => setLimitPrice(e.target.value)}
                style={inputStyle}
              />
            </div>
          </>
        ) : null}

        <div style={fieldStyle}>
          <label style={labelStyle}>AMOUNT {wallet ? "(TON)" : ""}</label>
          <input 
            type="number" 
            step="0.1" 
            placeholder={wallet ? "1.0" : "Enter amount"} 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
            disabled={!wallet}
          />
        </div>

        {/* Payment Options */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
          {/* DK Bank Payment Button */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Enter CID Number"
              value={cidNumber}
              onChange={(e) => setCidNumber(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #2a3a4a",
                borderRadius: "6px",
                backgroundColor: "#1a2332",
                color: "#fff",
                fontSize: "0.9rem",
                width: "200px"
              }}
            />
            <button
              onClick={() => {
                if (!selectedOutcomeId) {
                  alert("Please select an outcome first");
                  return;
                }
                if (!cidNumber) {
                  alert("Please enter your CID number");
                  return;
                }
                setBetAmount(parseFloat(amount || "0"));
                setShowPaymentSelector(true);
              }}
              disabled={!selectedOutcomeId || !cidNumber}
              style={{
                background: "#2a3a4a",
                color: "#6ab3f3",
                border: "1px solid #6ab3f3",
                padding: "12px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.9rem",
                opacity: (!selectedOutcomeId || !cidNumber) ? 0.6 : 1,
              }}
            >
              🏦 DK Bank Payment
            </button>
          </div>   {/* TON Wallet Connection */}
          {wallet ? (
            <span style={{ color: "#4CAF50", fontSize: "0.8rem" }}>✓ TON Connected</span>
          ) : (
            <TonConnectButton />
          )}
        </div>

        {selectedOutcomeId && amount && parseFloat(amount) > 0 && (
          <div style={{
            background: "rgba(82, 136, 193, 0.1)",
            border: "1px solid #5288c144",
            borderRadius: "8px",
            padding: "12px",
            marginTop: "4px"
          }}>
            {isSCPM ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#708499", fontSize: "0.75rem" }}>ESTIMATED PAYOUT</span>
                  <span style={{ color: "#4CAF50", fontWeight: 700, fontSize: "0.9rem" }}>
                    {(() => {
                      const tonAmount = Number(amount || 0);
                      const outcome = market.outcomes.find(o => o.id === selectedOutcomeId);
                      if (!outcome) return "0.00 TON";
                      
                      const b = Number(market.liquidityParam || 1000);
                      const prob = Number(outcome.lmsrProbability || 0.5);
                      const avgPrice = prob + (tonAmount / (b || 1)) * (1 - prob) / 2;
                      const shares = tonAmount / (avgPrice || 1);
                      
                      return isNaN(shares) ? "0.00 TON" : shares.toFixed(2) + " TON";
                    })()}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#708499", fontSize: "0.7rem" }}>POTENTIAL PROFIT</span>
                  <span style={{ color: "#6ab3f3", fontWeight: 600, fontSize: "0.8rem" }}>
                    {(() => {
                      const tonAmount = Number(amount || 0);
                      const outcome = market.outcomes.find(o => o.id === selectedOutcomeId);
                      if (!outcome) return "+0.00 (0% ROI)";
                      
                      const b = Number(market.liquidityParam || 1000);
                      const prob = Number(outcome.lmsrProbability || 0.5);
                      const avgPrice = prob + (tonAmount / (b || 1)) * (1 - prob) / 2;
                      const payout = tonAmount / (avgPrice || 1);
                      const profit = payout - tonAmount;
                      const roi = tonAmount > 0 ? (profit / tonAmount) * 100 : 0;
                      
                      if (isNaN(profit) || isNaN(roi)) return "+0.00 (0% ROI)";
                      return `+${profit.toFixed(2)} (${roi.toFixed(0)}% ROI)`;
                    })()}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ 
                color: "#f5f5f5", 
                fontSize: "0.85rem", 
                lineHeight: 1.4,
                textAlign: "center",
                padding: "8px 0"
              }}>
                You will receive your payout automatically at the end of the event based on the final total pool.
              </div>
            )}
          </div>
        )}

        <button 
          onClick={handlePlaceBet}
          disabled={loading || !selectedOutcomeId || !amount}
          style={{
            ...buttonStyle,
            opacity: (loading || !selectedOutcomeId || !amount) ? 0.6 : 1,
            cursor: (loading || !selectedOutcomeId || !amount) ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Processing..." : "Choose Payment Method"}
        </button>
      </div>

      {/* Payment Selector */}
      {showPaymentSelector && (
        <PwaPaymentSelector
          amount={betAmount}
          description={`Bet on ${market.outcomes.find(o => o.id === selectedOutcomeId)?.label} in "${market.title}"`}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={handlePaymentFailure}
        />
      )}
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  background: "#17212b",
  border: "1px solid #2a3a4a",
  borderRadius: "12px",
  padding: "20px",
  marginTop: "24px",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#708499",
  fontWeight: 700,
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  background: "#232e3c",
  border: "1px solid #2a3a4a",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "#fff",
  fontSize: "1rem",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  background: "#5288c1",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "14px",
  fontSize: "1rem",
  fontWeight: 700,
  marginTop: "8px",
  transition: "background 0.2s",
};
