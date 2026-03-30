import { FC, useState, useEffect } from "react";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { getMarkets, getDisputes, submitDispute, placeBet, loginWithDKBank, type Market, type Dispute } from "@/api/client";
import { initiateDKBankPayment, checkDKBankPaymentStatus } from "@/api/dkbank";
import { useAuth } from "@/tma/hooks/useAuth";
import { TmaPaymentModal } from "@/tma/components/TmaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { PoolDetails } from "@/components/PoolDetails";

function outcomeColor(rank: number, total: number): string {
  if (rank === 0) return "#22c55e";
  if (rank === total - 1 && total > 1) return "#ef4444";
  return "#f59e0b";
}

function useCountdown(targetAt: string | null): string {
  const [label, setLabel] = useState("Open");
  useEffect(() => {
    if (!targetAt) return;
    const tick = () => {
      const ms = new Date(targetAt).getTime() - Date.now();
      if (ms <= 0) { setLabel("Expired"); return; }
      const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(h > 24 ? `${Math.floor(h / 24)}d left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [targetAt]);
  return label;
}

// ── Dispute Panel ───────────────────────────────────────────────────────────

type DisputeStep = "form" | "processing" | "success" | "failed";
type DisputeMethod = "dkbank" | "ton";

function DisputePanel({ market }: { market: Market }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [method, setMethod] = useState<DisputeMethod>("dkbank");
  const [cid, setCid] = useState("");
  const [bondAmount, setBondAmount] = useState("50");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<DisputeStep>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deadline = useCountdown(market.disputeDeadlineAt ?? null);

  useEffect(() => {
    getDisputes(market.id).then(setDisputes).catch(() => {});
  }, [market.id]);

  const proposedOutcome = market.outcomes.find((o) => o.id === market.proposedOutcomeId);
  const amt = Number(bondAmount);
  const canSubmit = method === "dkbank" && cid.length === 11 && amt >= 1 && step === "form";

  const pollStatus = async (paymentId: string, amount: number) => {
    const max = 24;
    let attempts = 0;
    const poll = async () => {
      try {
        const s = await checkDKBankPaymentStatus(paymentId);
        if (s.status === "success") {
          await submitDispute(market.id, { paymentId, reason: reason.trim() || undefined });
          setDisputes((prev) => [...prev, { id: Date.now().toString(), bondAmount: String(amount), reason: reason.trim() || null, bondRefunded: false, createdAt: new Date().toISOString(), userId: "", marketId: market.id }]);
          setStep("success");
        } else if (s.status === "failed") {
          setError(s.failureReason || "Payment failed");
          setStep("failed");
        } else if (attempts < max) {
          attempts++;
          setStatusMsg(`Waiting for DK Bank confirmation… (${attempts})`);
          setTimeout(poll, 10_000);
        } else {
          setError("Payment verification timeout. Please try again.");
          setStep("failed");
        }
      } catch {
        if (attempts < max) { attempts++; setTimeout(poll, 10_000); }
        else { setError("Unable to verify payment"); setStep("failed"); }
      }
    };
    poll();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStep("processing");
    setStatusMsg("Verifying CID with DK Bank…");
    setError(null);
    try {
      await loginWithDKBank(cid);
      setStatusMsg("Initiating bond payment…");
      const payment = await initiateDKBankPayment({
        amount: amt,
        customerPhone: cid,
        description: `Dispute bond: ${market.title}`,
      });
      if (payment.status === "success") {
        await submitDispute(market.id, { paymentId: payment.paymentId, reason: reason.trim() || undefined });
        setDisputes((prev) => [...prev, { id: Date.now().toString(), bondAmount: String(amt), reason: reason.trim() || null, bondRefunded: false, createdAt: new Date().toISOString(), userId: "", marketId: market.id }]);
        setStep("success");
      } else {
        setStatusMsg("OTP sent to your DK Bank phone. Waiting for confirmation…");
        pollStatus(payment.paymentId, amt);
      }
    } catch (e: any) {
      setError(e.message ?? "Payment failed");
      setStep("failed");
    }
  };

  return (
    <div style={{
      background: "#fffbeb", border: "1.5px solid #f59e0b",
      borderRadius: 10, padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          ⚖️ Dispute Window
        </div>
        <div style={{ fontSize: 10, color: "#92400e" }}>{deadline}</div>
      </div>

      {/* Proposed outcome */}
      {proposedOutcome && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ color: "#6b7280" }}>Proposed:</span>
          <span style={{ fontWeight: 700, color: "#111827" }}>{proposedOutcome.label}</span>
          <span style={{ background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4 }}>Admin</span>
        </div>
      )}

      {disputes.length > 0 && (
        <div style={{ fontSize: 10, color: "#92400e" }}>
          {disputes.length} dispute{disputes.length !== 1 ? "s" : ""} submitted
        </div>
      )}

      {step === "success" ? (
        <div style={{ fontSize: 12, color: "#059669", fontWeight: 600, textAlign: "center", padding: "4px 0" }}>
          Dispute recorded. Your bond payment was verified via DK Bank OTP and will be refunded after admin resolution.
        </div>
      ) : step === "failed" ? (
        <>
          <div style={{ fontSize: 11, color: "#ef4444" }}>{error}</div>
          <button onClick={() => { setStep("form"); setError(null); }} style={{ padding: "6px 0", borderRadius: 7, background: "#f59e0b", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Try Again
          </button>
        </>
      ) : step === "processing" ? (
        <div style={{ fontSize: 11, color: "#92400e", textAlign: "center", padding: "4px 0" }}>
          {statusMsg}<br />
          <span style={{ fontSize: 9, opacity: 0.8 }}>Confirm the OTP sent to your registered DK Bank number</span>
        </div>
      ) : (
        <>
          {/* Payment method selector */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setMethod("dkbank")}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: method === "dkbank" ? "#f59e0b" : "#fff",
                color: method === "dkbank" ? "#fff" : "#92400e",
                border: `1.5px solid ${method === "dkbank" ? "#f59e0b" : "#fcd34d"}`,
              }}
            >
              DK Bank
            </button>
            <button
              disabled
              style={{
                flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: "#f9fafb", color: "#9ca3af", border: "1.5px solid #e5e7eb", cursor: "not-allowed",
              }}
            >
              TON · Soon
            </button>
          </div>

          {method === "dkbank" && (
            <>
              <input
                type="number"
                min={1}
                value={bondAmount}
                onChange={(e) => setBondAmount(e.target.value)}
                placeholder="Bond amount (Nu)"
                style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #fcd34d", background: "#fff", fontSize: 12, color: "#111827", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <input
                type="text"
                inputMode="numeric"
                value={cid}
                onChange={(e) => setCid(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="Your 11-digit CID"
                style={{ padding: "6px 8px", borderRadius: 7, border: `1px solid ${cid.length > 0 && cid.length !== 11 ? "#fca5a5" : "#fcd34d"}`, background: "#fff", fontSize: 12, color: "#111827", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 9, color: "#92400e" }}>
                An OTP will be sent to the phone registered with your CID to verify payment
              </div>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #fcd34d", background: "#fff", fontSize: 12, color: "#111827", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              {error && <div style={{ fontSize: 10, color: "#ef4444" }}>{error}</div>}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  padding: "8px 0", borderRadius: 8,
                  background: canSubmit ? "#f59e0b" : "#e5e7eb",
                  border: "none", color: canSubmit ? "#fff" : "#9ca3af",
                  fontSize: 12, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {cid.length !== 11 ? "Enter 11-digit CID" : `Pay Nu ${amt} via DK Bank`}
              </button>
              <div style={{ fontSize: 9, color: "#92400e", textAlign: "center" }}>
                Bond is fully refunded after admin resolution
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Market Card ───────────────────────────────────────────────────────────────

function MarketCard({ market, onBet, lastUpdated }: {
  market: Market;
  onBet: (outcomeId: string) => void;
  lastUpdated?: Date | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const isResolving = market.status === "resolving";
  const countdown = useCountdown(market.closesAt);
  const totalPool = Number(market.totalPool);

  const sentiment = (() => {
    const raw = market.outcomes.map((o) => ({
      ...o,
      pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
    }));
    const sorted = [...raw].sort((a, b) => b.pct - a.pct);
    return raw.map((o) => {
      const rank = sorted.findIndex((s) => s.id === o.id);
      return { ...o, color: outcomeColor(rank, raw.length) };
    });
  })();

  const isBinary = sentiment.length <= 2;

  return (
    <div style={{
      background: "#ffffff",
      border: isResolving ? "1.5px solid #f59e0b" : "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "14px",
      marginBottom: 10,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
    }}>
      {isResolving && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "linear-gradient(90deg, #f59e0b, #d97706)",
          color: "#fff", padding: "2px 8px", fontSize: "0.55rem", fontWeight: 800,
          borderBottomLeftRadius: 8, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>Resolving</div>
      )}

      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: "#111827" }}>
        {market.title}
      </div>

      {/* Outcomes / Dispute panel */}
      {isResolving ? (
        <DisputePanel market={market} />
      ) : isBinary ? (
        <>
          {/* Probability display */}
          <div style={{ display: "flex", gap: 8 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.pct.toFixed(0)}%</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Probability bar */}
          <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", gap: 1 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ width: `${s.pct}%`, background: s.color, minWidth: s.pct > 0 ? 2 : 0 }} />
            ))}
          </div>
          {/* Bet buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {sentiment.map((s) => (
              <button
                key={s.id}
                onClick={() => onBet(s.id)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 9,
                  border: `1.5px solid ${s.color}`,
                  background: s.color, color: "#ffffff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  transition: "opacity 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Bet {s.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Multi-outcome: collapsible rows */
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {(showAll ? sentiment : sentiment.slice(0, 2)).map((s) => (
            <button
              key={s.id}
              onClick={() => onBet(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 9,
                border: "1.5px solid #e5e7eb",
                background: "#f9fafb", cursor: "pointer",
                transition: "all 0.12s", textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = s.color;
                e.currentTarget.style.background = `${s.color}0f`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e5e7eb";
                e.currentTarget.style.background = "#f9fafb";
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#111827", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              <div style={{ width: 48, height: 3, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ width: `${s.pct}%`, height: "100%", background: s.color }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: s.color, minWidth: 28, textAlign: "right", flexShrink: 0 }}>{s.pct.toFixed(0)}%</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#ffffff",
                background: s.color, borderRadius: 6, padding: "2px 7px", flexShrink: 0,
              }}>Bet</span>
            </button>
          ))}
          {sentiment.length > 2 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                padding: "6px 10px", borderRadius: 9,
                border: "1.5px solid #e5e7eb",
                background: "transparent", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: "#6b7280",
                textAlign: "center", transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#9ca3af"; e.currentTarget.style.color = "#374151"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; }}
            >
              {showAll ? "Show less" : `+${sentiment.length - 2} more`}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#9ca3af" }}>
        <PoolDetails market={market} lastUpdated={lastUpdated} />
        <span>{isResolving ? "Dispute window" : countdown}</span>
      </div>
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────

interface ActiveBet { marketId: string; outcomeId: string; }

export const TmaFeedPage: FC = () => {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => {
        setMarkets(d.filter((m) => m.status === "open" || m.status === "resolving"));
        setLastUpdated(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    setMarkets((prev) => prev.map((m) => {
      if (m.id !== activeBet.marketId) return m;
      return {
        ...m,
        totalPool: String(Number(m.totalPool) + betAmt),
        outcomes: m.outcomes.map((o) =>
          o.id === activeBet.outcomeId
            ? { ...o, totalBetAmount: String(Number(o.totalBetAmount) + betAmt) }
            : o
        ),
      };
    }));

    const bet = activeBet;
    setActiveBet(null);

    const market = markets.find((m) => m.id === bet.marketId);
    if (market && user) {
      try { await placeBet(market.id, { outcomeId: bet.outcomeId, amount: betAmt }); }
      catch (e: any) { console.warn(e.message); }
    }

    getMarkets()
      .then((d) => {
        setMarkets(d.filter((m) => m.status === "open" || m.status === "resolving"));
        setLastUpdated(new Date());
      })
      .catch(console.error);
  };

  if (loading) return (
    <Page>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Spinner size="l" />
      </div>
    </Page>
  );

  if (!markets.length) return (
    <Page>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12, textAlign: "center", padding: "0 32px" }}>
        <div style={{ fontSize: 48 }}>🔮</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>No open predictions</div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>Check back soon.</div>
      </div>
    </Page>
  );

  const openMarkets = markets.filter((m) => m.status === "open");
  const resolvingMarkets = markets.filter((m) => m.status === "resolving");
  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

  return (
    <Page>
      <div style={{ padding: "10px 10px 80px", background: "#f5f5f7", minHeight: "100vh" }}>
        {resolvingMarkets.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 8, paddingLeft: 2 }}>
               Dispute Window — {resolvingMarkets.length} pending
            </div>
            {resolvingMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
                lastUpdated={lastUpdated}
              />
            ))}
          </>
        )}
        {openMarkets.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 10, paddingLeft: 2 }}>
              {openMarkets.length} open prediction{openMarkets.length !== 1 ? "s" : ""}
            </div>
            {openMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
                lastUpdated={lastUpdated}
              />
            ))}
          </>
        )}
      </div>
      {activeMarket && activeBet && (
        <TmaPaymentModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={handlePaymentSuccess}
          onFailure={(e) => console.error(e)}
        />
      )}
    </Page>
  );
};
