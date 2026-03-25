import { FC, useState } from "react";
import {
  useTonWallet,
  useTonConnectUI,
  TonConnectButton,
} from "@tonconnect/ui-react";
import { Market, placeBetWithWallet } from "@/api/client";

interface PwaBetFormProps {
  market: Market;
  onBetPlaced?: (updatedMarket?: Market) => void;
}

export const PwaBetForm: FC<PwaBetFormProps> = ({ market, onBetPlaced }) => {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("0.5");
  const [maxShares, setMaxShares] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isSCPM = String(market.mechanism || "").toLowerCase().includes("scpm") || 
                 market.title.toLowerCase().includes("btc");

  const handlePlaceBet = async () => {
    if (!selectedOutcomeId || !amount || (!wallet && !isDemoMode)) return;

    setLoading(true);
    try {
      const tonAmount = parseFloat(amount || "0");
      if (tonAmount <= 0) throw new Error("Amount must be positive");

      let finalWalletAddress = isDemoMode ? "EQDemoWallet888888888888888888888888888888888888" : wallet?.account.address;
      let finalTxHash = isDemoMode ? "demo-tx-" + Date.now() : "";

      if (!isDemoMode) {
        // Real TON Transaction
        const PLATFORM_WALLET = "EQD..."; 
        const nanoAmount = (tonAmount * 1_000_000_000).toString();

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
        finalTxHash = tx.boc;
      } else {
        // Simulate block delay for demo effect
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (isDemoMode) {
        // --- STATIC CALCULATION FOR DEMO ---
        const updatedMarket = { ...market };
        updatedMarket.totalPool = (Number(market.totalPool || 0) + tonAmount).toString();
        
        updatedMarket.outcomes = market.outcomes.map(o => {
          if (o.id === selectedOutcomeId) {
            const newAmount = Number(o.totalBetAmount || 0) + tonAmount;
            
            // Simplified SCPM/LMSR shift for Demo logic
            let newProb = Number(o.lmsrProbability || 0);
            if (isSCPM) {
              const b = Number(market.liquidityParam || 1000);
              // Shift probability based on log-sum-exp logic (simplified)
              newProb = Math.min(0.99, newProb + (tonAmount / b) * (1 - newProb));
            } else {
              newProb = newAmount / Number(updatedMarket.totalPool || 1);
            }

            return { 
              ...o, 
              totalBetAmount: newAmount.toString(),
              lmsrProbability: newProb
            };
          } else {
            // Adjust other probabilities to sum to 1
            let newProb = Number(o.lmsrProbability || 0);
            if (isSCPM) {
              const b = Number(market.liquidityParam || 1000);
              newProb = Math.max(0.01, newProb - (tonAmount / b) * newProb);
            } else {
              newProb = Number(o.totalBetAmount || 0) / Number(updatedMarket.totalPool || 1);
            }
            return { ...o, lmsrProbability: newProb };
          }
        });

        await new Promise(resolve => setTimeout(resolve, 800));
        if (onBetPlaced) onBetPlaced(updatedMarket);
      } else {
        // Real bet flow
        await placeBetWithWallet(market.id, {
          outcomeId: selectedOutcomeId,
          amount: tonAmount,
          maxShares: isSCPM ? parseFloat(maxShares || "0") : undefined,
          limitPrice: isSCPM ? parseFloat(limitPrice || "0") : undefined,
          walletAddress: finalWalletAddress!,
          txHash: finalTxHash,
        });
        if (onBetPlaced) onBetPlaced();
      }

      alert(`✅ ${isDemoMode ? "Demo " : ""}Bet placed successfully!`);
      
      setAmount("");
      setMaxShares("");
      setSelectedOutcomeId(null);
    } catch (err: any) {
      alert("❌ Failed: " + (err.message || "Transaction failed"));
    } finally {
      setLoading(false);
    }
  };

  if (!wallet && !isDemoMode) {
    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: "16px", color: "#708499" }}>
          Connect your TON wallet to start betting
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <TonConnectButton />
          <span style={{ color: "#708499", fontSize: "0.8rem" }}>OR</span>
          <button 
            onClick={() => setIsDemoMode(true)}
            style={{
              background: "#2a3a4a",
              color: "#6ab3f3",
              border: "1px dashed #6ab3f3",
              padding: "8px 16px",
              borderRadius: "16px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem"
            }}
          >
             Demo Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: "1rem", color: "#6ab3f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Place a Bet</span>
        {isDemoMode && (
          <span style={{ background: "#FF9800", color: "#000", fontSize: "0.6rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 800 }}>
            DEMO MODE
          </span>
        )}
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
          <label style={labelStyle}>AMOUNT (TON)</label>
          <input 
            type="number" 
            step="0.1" 
            placeholder="1.0" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
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
                      if (!outcome) return "0.00";
                      
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
          {loading ? "Processing..." : "Confirm Bet"}
        </button>
      </div>
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
