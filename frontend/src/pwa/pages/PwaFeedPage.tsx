import { useState, useEffect } from "react";
import { getMarkets, getDisputes, submitDispute, placeBet, loginWithDKBank, type Market, type Dispute } from "@/api/client";
import { initiateDKBankPayment, checkDKBankPaymentStatus } from "@/api/dkbank";
import { PwaPaymentModal } from "../components/PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { PoolDetails } from "@/components/PoolDetails";

function outcomeColor(rank: number, total: number): string {
  if (rank === 0) return "#22c55e";                          // highest → green
  if (rank === total - 1 && total > 1) return "#ef4444";    // lowest  → red
  return "#f59e0b";                                          // middle  → amber
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
    const max = 24; // 4 min
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

      {/* States */}
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
                flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1.5px solid ${method === "dkbank" ? "#f59e0b" : "#e5e7eb"}`,
                background: method === "dkbank" ? "#fef3c7" : "#f9fafb",
                color: method === "dkbank" ? "#92400e" : "#9ca3af",
              }}
            >DK Bank</button>
            <button
              onClick={() => setMethod("ton")}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "not-allowed",
                border: "1.5px solid #f3f4f6", background: "#f9fafb", color: "#d1d5db", opacity: 0.6,
              }}
              disabled
            >TON · Soon</button>
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

// ── Market Card ────────────────────────────────────────────────────────────────

function MarketCard({ market, onBet, lastUpdated }: {
  market: Market;
  onBet: (outcomeId: string) => void;
  lastUpdated?: Date | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const isUpcoming = market.status === "upcoming";
  const isResolving = market.status === "resolving";
  const countdown = useCountdown(isUpcoming ? market.opensAt ?? null : market.closesAt);
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

  const cardBorder = isResolving ? "1.5px solid #f59e0b" : isUpcoming ? "1px solid #dbeafe" : "1px solid #e5e7eb";

  return (
    <div style={{
      background: "#ffffff",
      border: cardBorder,
      borderRadius: 14,
      padding: "14px",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      boxSizing: "border-box",
      gap: 10,
      position: "relative",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      {isUpcoming && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "linear-gradient(90deg, #3b82f6, #2563eb)",
          color: "#fff", padding: "2px 8px", fontSize: "0.55rem", fontWeight: 800,
          borderBottomLeftRadius: 8, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>Soon</div>
      )}
      {isResolving && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: "linear-gradient(90deg, #f59e0b, #d97706)",
          color: "#fff", padding: "2px 8px", fontSize: "0.55rem", fontWeight: 800,
          borderBottomLeftRadius: 8, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>Resolving</div>
      )}

      {/* Title */}
      <div style={{
        fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: "#111827",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", minHeight: "2.7em",
      }}>
        {market.title}
      </div>

      {/* Outcomes / Dispute panel */}
      {isResolving ? (
        <DisputePanel market={market} />
      ) : isUpcoming ? (
        <div style={{ display: "flex", gap: 8 }}>
          {sentiment.map((s) => (
            <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#d1d5db" }}>—</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : isBinary ? (
        <>
          {/* Probability bars */}
          <div style={{ display: "flex", gap: 8 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.pct.toFixed(0)}%</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", gap: 1 }}>
            {sentiment.map((s) => (
              <div key={s.id} style={{ width: `${s.pct}%`, background: s.color, minWidth: s.pct > 0 ? 2 : 0 }} />
            ))}
          </div>
          {/* Clearly styled bet buttons */}
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
                  transition: "opacity 0.12s", letterSpacing: "0.01em",
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
        /* Multi-outcome: rows with a visible Bet chip */
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#9ca3af", marginTop: "auto" }}>
        {!isUpcoming
          ? <PoolDetails market={market} lastUpdated={lastUpdated} />
          : <span>Upcoming</span>
        }
        <span>{isUpcoming ? `Opens ${countdown}` : isResolving ? "Dispute window" : countdown}</span>
      </div>
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────

interface ActiveBet { marketId: string; outcomeId: string; }

export function PwaFeedPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const bp = useBreakpoint();

  useEffect(() => {
    getMarkets()
      .then((d) => {
        setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming" || m.status === "resolving"));
        setLastUpdated(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    // Optimistically update local state so percentages change immediately
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

    setActiveBet(null);

    const market = markets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        await placeBet(market.id, { outcomeId: activeBet.outcomeId, amount: betAmt });
      }
      catch (e: any) { console.warn(e.message); }
    }

    // Refresh from server to get accurate numbers
    getMarkets()
      .then((d) => {
        setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming" || m.status === "resolving"));
        setLastUpdated(new Date());
      })
      .catch(console.error);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 0" }}>
      <div style={{ textAlign: "center", color: "#9ca3af" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
        <div>Loading predictions…</div>
      </div>
    </div>
  );

  if (!markets.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 32px", textAlign: "center", gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔮</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>No open predictions</div>
      <div style={{ fontSize: 14, color: "#9ca3af" }}>Check back soon.</div>
    </div>
  );

  const gridCols = bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  const openMarkets = markets.filter((m) => m.status === "open");
  const resolvingMarkets = markets.filter((m) => m.status === "resolving");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

  const grid = (items: typeof markets) => (
    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 12, alignItems: "stretch" }}>
      {items.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
          lastUpdated={lastUpdated}
        />
      ))}
    </div>
  );

  return (
    <div style={{ padding: bp === "mobile" ? "16px 12px 80px" : "20px 16px 60px", maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
      {openMarkets.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            🟢 Active — {openMarkets.length} open
          </div>
          {grid(openMarkets)}
        </section>
      )}
      {resolvingMarkets.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
             Dispute Window — {resolvingMarkets.length} pending
          </div>
          {grid(resolvingMarkets)}
        </section>
      )}
      {upcomingMarkets.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Upcoming
          </div>
          {grid(upcomingMarkets)}
        </section>
      )}

      {activeMarket && activeBet && (
        <PwaPaymentModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={handlePaymentSuccess}
          onFailure={(e) => console.error(e)}
        />
      )}
    </div>
  );
}
