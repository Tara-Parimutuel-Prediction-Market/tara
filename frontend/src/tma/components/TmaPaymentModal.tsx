import { useState, useRef, useEffect } from "react";
import {
  initiateDKBankPayment,
  confirmDKBankPayment,
  checkDKBankPaymentStatus,
  formatBTN,
} from "@/api/dkbank";
import { getMe } from "@/api/client";
import type { Market } from "@/api/client";
import type { DKBankPaymentRequest, PaymentResponse } from "@/types/payment";
import { PayoutBreakdown } from "@/components/PayoutBreakdown";

const QUICK_AMOUNTS = [50, 100, 200, 500];
const MIN_BET = 50;

interface TmaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  outcomeId: string;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

type Status = "idle" | "processing" | "otp_required" | "success" | "failed";

export function TmaPaymentModal({
  isOpen,
  onClose,
  market,
  outcomeId,
  onSuccess,
  onFailure,
}: TmaPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<"dkbank" | null>(null);
  const [amountStr, setAmountStr] = useState("100");
  const [cidNumber, setCidNumber] = useState("");
  const [linkedCid, setLinkedCid] = useState<string | null>(null); // from user's profile
  const [customerName, setCustomerName] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pendingPaymentId, setPendingPaymentId] = useState("");
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch user's linked CID when modal opens — auto-fill and lock
  useEffect(() => {
    if (!isOpen) return;
    getMe()
      .then((u) => {
        if (u.dkCid) {
          setLinkedCid(u.dkCid);
          setCidNumber(u.dkCid);
          if (u.dkAccountName) setCustomerName(u.dkAccountName);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => setViewportHeight(vv.height);
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  const betAmount = parseFloat(amountStr) || 0;
  const isValidAmount = betAmount >= MIN_BET;
  // Payment is only allowed when using the user's own linked CID
  const canPay =
    isValidAmount &&
    !!linkedCid &&
    cidNumber === linkedCid &&
    status === "idle" &&
    selectedMethod === "dkbank";

  const estPayout = (() => {
    if (!isValidAmount || !outcome) return 0;
    const houseEdge = parseFloat(market.houseEdgePct) || 0;
    const outcomePool = Number(outcome.totalBetAmount) + betAmount;
    const totalPool = Number(market.totalPool) + betAmount;
    if (outcomePool <= 0) return 0;
    return betAmount * ((totalPool * (1 - houseEdge / 100)) / outcomePool);
  })();
  const estProfit = estPayout - betAmount;

  useEffect(() => {
    if (selectedMethod === "dkbank")
      setTimeout(() => inputRef.current?.focus(), 50);
  }, [selectedMethod]);

  if (!isOpen) return null;

  const resetForm = () => {
    setSelectedMethod(null);
    setAmountStr("100");
    setCidNumber("");
    setLinkedCid(null);
    setCustomerName("");
    setOtpValue("");
    setStatus("idle");
    setError("");
    setPendingPaymentId("");
  };

  const handleClose = () => {
    if (status === "processing") return;
    onClose();
    resetForm();
  };

  const handlePay = async () => {
    if (!canPay) return;
    setStatus("processing");
    setError("");
    try {
      const req: DKBankPaymentRequest = {
        amount: betAmount,
        customerPhone: cidNumber,
        customerName: customerName || undefined,
        description: `Predict: ${market.title} — ${outcome?.label}`,
        merchantTxnId: `TARA_TMA_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      const payment = await initiateDKBankPayment(req);
      if (payment.otpRequired) {
        setPendingPaymentId(payment.paymentId);
        setStatus("otp_required");
      } else if (payment.status === "success") {
        setStatus("success");
        setTimeout(() => {
          onClose();
          resetForm();
          onSuccess?.({ ...payment, amount: betAmount });
        }, 2500);
      } else {
        pollStatus(payment.paymentId, payment);
      }
    } catch (err: any) {
      setError(err.message || "Payment failed");
      setStatus("failed");
      onFailure?.(err.message || "Payment failed");
    }
  };

  const handleConfirmOtp = async () => {
    if (!otpValue || otpValue.length < 4 || !pendingPaymentId) return;
    setStatus("processing");
    setError("");
    try {
      const confirmed = await confirmDKBankPayment(pendingPaymentId, otpValue);
      pollStatus(confirmed.paymentId, confirmed);
    } catch (err: any) {
      setError(err.message || "OTP confirmation failed");
      setStatus("otp_required");
    }
  };

  const pollStatus = async (
    paymentId: string,
    initiatedPayment: PaymentResponse,
  ) => {
    const max = 30;
    let attempts = 0;
    const poll = async () => {
      try {
        const s = await checkDKBankPaymentStatus(paymentId);
        if (s.status === "success") {
          setStatus("success");
          setTimeout(() => {
            onClose();
            resetForm();
            onSuccess?.({ ...initiatedPayment, amount: betAmount });
          }, 2500);
        } else if (s.status === "failed") {
          setError(s.failureReason || "Payment failed");
          setStatus("failed");
          onFailure?.(s.failureReason || "Payment failed");
        } else if (attempts < max) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setError("Payment verification timeout");
          setStatus("failed");
          onFailure?.("Payment verification timeout");
        }
      } catch {
        if (attempts < max) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setError("Unable to verify payment");
          setStatus("failed");
        }
      }
    };
    poll();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <style>{`
        @keyframes tmaModalUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tmaSuccessPop {
          0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          55%  { transform: scale(1.25) rotate(4deg); opacity: 1; }
          75%  { transform: scale(0.92) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes tmaSuccessGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.4); }
          50%       { box-shadow: 0 0 0 18px rgba(22,163,74,0); }
        }
        @keyframes tmaFailShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15%       { transform: translateX(-8px) rotate(-6deg); }
          30%       { transform: translateX(8px) rotate(6deg); }
          45%       { transform: translateX(-6px) rotate(-3deg); }
          60%       { transform: translateX(6px) rotate(3deg); }
          75%       { transform: translateX(-3px); }
        }
        @keyframes tmaFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: "24px 20px 28px",
          width: "100%",
          maxWidth: 460,
          margin: "0 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          animation: "tmaModalUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
          maxHeight: `${viewportHeight * 0.9}px`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Success ── */}
        {status === "success" && (
          <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
                marginBottom: 16,
                animation:
                  "tmaSuccessPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, tmaSuccessGlow 1.2s ease 0.55s 2",
              }}
            >
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#16a34a",
                marginBottom: 6,
                animation: "tmaFadeIn 0.35s ease 0.3s both",
              }}
            >
              Bet Placed!
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                animation: "tmaFadeIn 0.35s ease 0.45s both",
              }}
            >
              Your payment was confirmed
            </div>
          </div>
        )}

        {/* ── Failed ── */}
        {status === "failed" && (
          <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #fee2e2, #fecaca)",
                marginBottom: 16,
                animation:
                  "tmaFailShake 0.55s cubic-bezier(0.36,0.07,0.19,0.97) forwards",
              }}
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#ef4444",
                marginBottom: 8,
                animation: "tmaFadeIn 0.35s ease 0.3s both",
              }}
            >
              Payment Failed
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginBottom: 24,
                lineHeight: 1.5,
                animation: "tmaFadeIn 0.35s ease 0.45s both",
              }}
            >
              {error || "Could not complete payment"}
            </div>
            <button
              onClick={() => {
                setStatus("idle");
                setError("");
                setOtpValue("");
              }}
              style={{
                padding: "12px 28px",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── OTP step ── */}
        {status === "otp_required" && (
          <div>
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 3,
                  }}
                >
                  Verify OTP
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}
                >
                  DK Bank
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  fontSize: 18,
                  color: "#6b7280",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{ height: 1, background: "#f3f4f6", marginBottom: 20 }}
            />

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📲</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: 4,
                }}
              >
                OTP Sent
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>
                Enter the code sent to you via Telegram bot
              </div>
            </div>

            <input
              type="text"
              inputMode="numeric"
              value={otpValue}
              onChange={(e) => {
                setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 8));
                setError("");
              }}
              placeholder="- - - - - -"
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "16px",
                borderRadius: 10,
                border: error ? "2px solid #ef4444" : "2px solid #e5e7eb",
                background: "#f9fafb",
                color: "#111827",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.3em",
                textAlign: "center",
                outline: "none",
              }}
            />
            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#ef4444",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleConfirmOtp}
              disabled={otpValue.length < 4}
              style={{
                width: "100%",
                padding: "14px",
                marginTop: 16,
                background: otpValue.length < 4 ? "#e5e7eb" : "#3b82f6",
                color: otpValue.length < 4 ? "#9ca3af" : "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: otpValue.length < 4 ? "not-allowed" : "pointer",
              }}
            >
              {`Confirm & Pay ${formatBTN(betAmount)}`}
            </button>
            <button
              onClick={() => {
                setStatus("idle");
                setOtpValue("");
                setError("");
              }}
              style={{
                width: "100%",
                padding: "12px",
                marginTop: 8,
                background: "transparent",
                color: "#9ca3af",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← Change CID
            </button>
          </div>
        )}

        {/* ── Main form (idle / processing) ── */}
        {(status === "idle" || status === "processing") && (
          <>
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 3,
                  }}
                >
                  Placing a bet on
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#111827",
                    lineHeight: 1.3,
                    marginBottom: 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {market.title}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 20,
                    padding: "4px 12px",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}
                  >
                    {outcome?.label}
                  </span>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  fontSize: 18,
                  color: "#6b7280",
                  cursor: status === "processing" ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{ height: 1, background: "#f3f4f6", marginBottom: 16 }}
            />

            {/* Payment method */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              Pay with
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setSelectedMethod("dkbank")}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  border:
                    selectedMethod === "dkbank"
                      ? "2px solid #3b82f6"
                      : "2px solid #e5e7eb",
                  background:
                    selectedMethod === "dkbank" ? "#eff6ff" : "#f9fafb",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color:
                        selectedMethod === "dkbank" ? "#1d4ed8" : "#374151",
                    }}
                  >
                    DK Bank
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        selectedMethod === "dkbank" ? "#60a5fa" : "#9ca3af",
                    }}
                  >
                    BTN · Nu
                  </div>
                </div>
              </button>
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "2px solid #f3f4f6",
                  background: "#fafafa",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: 0.45,
                }}
              >
                <div>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}
                  >
                    TON Wallet
                  </div>
                  <div style={{ fontSize: 11, color: "#d1d5db" }}>
                    Coming soon
                  </div>
                </div>
              </div>
            </div>

            {/* Amount + CID */}
            {selectedMethod === "dkbank" && (
              <>
                <div
                  style={{ height: 1, background: "#f3f4f6", marginBottom: 16 }}
                />

                {/* Amount */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Amount (Nu)
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmountStr(q.toString())}
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: 10,
                        border:
                          amountStr === q.toString()
                            ? "2px solid #3b82f6"
                            : "2px solid #e5e7eb",
                        background:
                          amountStr === q.toString() ? "#eff6ff" : "#f9fafb",
                        color:
                          amountStr === q.toString() ? "#3b82f6" : "#374151",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 13,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#9ca3af",
                      pointerEvents: "none",
                    }}
                  >
                    Nu
                  </span>
                  <input
                    ref={inputRef}
                    type="number"
                    min={MIN_BET}
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px 14px 12px 34px",
                      borderRadius: 10,
                      border:
                        isValidAmount || !betAmount
                          ? "2px solid #e5e7eb"
                          : "2px solid #fca5a5",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Estimated payout */}
                {isValidAmount && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: estProfit >= 0 ? "#f0fdf4" : "#f9fafb",
                      border: `1px solid ${estProfit >= 0 ? "#86efac" : "#e5e7eb"}`,
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Est. payout if win
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          color: estProfit >= 0 ? "#16a34a" : "#9ca3af",
                        }}
                      >
                        {estProfit >= 0 ? `Nu ${estPayout.toFixed(2)}` : "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Est. profit
                      </div>
                      {estProfit >= 0 ? (
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#16a34a",
                          }}
                        >
                          +Nu {estProfit.toFixed(2)}
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            maxWidth: 120,
                            textAlign: "right",
                          }}
                        >
                          Grows as more bets join
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payout breakdown */}
                {isValidAmount && (
                  <PayoutBreakdown
                    market={market}
                    outcomeId={outcomeId}
                    betAmount={betAmount}
                  />
                )}

                {/* CID — locked to user's linked account */}
                <div style={{ marginBottom: 12, marginTop: 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    CID Number {linkedCid ? "🔒" : "*"}
                  </label>
                  {linkedCid ? (
                    <div
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "2px solid #d1fae5",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#065f46",
                        background: "#f0fdf4",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ fontFamily: "monospace", letterSpacing: 2 }}
                      >
                        {linkedCid}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#16a34a",
                          fontWeight: 700,
                        }}
                      >
                        Your account ✓
                      </span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cidNumber}
                      onChange={(e) =>
                        setCidNumber(
                          e.target.value.replace(/\D/g, "").slice(0, 11),
                        )
                      }
                      placeholder="11-digit CID"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "2px solid #fca5a5",
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#111827",
                        background: "#fff7f7",
                        outline: "none",
                      }}
                    />
                  )}
                  {!linkedCid && (
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#ef4444",
                      }}
                    >
                      ⚠️ No DK Bank account linked. Go to Profile → Link DK Bank
                      Account first.
                    </p>
                  )}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "2px solid #e5e7eb",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#111827",
                      background: "#f9fafb",
                      outline: "none",
                    }}
                  />
                </div>
              </>
            )}

            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  color: "#ef4444",
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!canPay}
              style={{
                width: "100%",
                padding: "14px",
                background: canPay ? "#3b82f6" : "#e5e7eb",
                color: canPay ? "#fff" : "#9ca3af",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: canPay ? "pointer" : "not-allowed",
              }}
            >
              {status === "processing"
                ? "Processing…"
                : canPay
                  ? `Pay ${formatBTN(betAmount)} with DK Bank`
                  : !isValidAmount
                    ? `Min Nu ${MIN_BET}`
                    : "Enter CID to continue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
