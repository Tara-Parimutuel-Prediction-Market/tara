import { useState, useEffect, useRef } from "react";
import {
  initiateDKBankPayment,
  confirmDKBankPayment,
  checkDKBankPaymentStatus,
  formatBTN,
} from "@/api/dkbank";
import { getMe } from "@/api/client";
import type { Market } from "@/api/client";
import type { DKBankPaymentRequest, PaymentResponse } from "@/types/payment";

interface DKBankConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  outcomeId: string;
  amount: number;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

type Status = "idle" | "processing" | "otp_required" | "success" | "failed";

export function DKBankConfirmModal({
  isOpen,
  onClose,
  market,
  outcomeId,
  amount,
  onSuccess,
  onFailure,
}: DKBankConfirmModalProps) {
  const [cidNumber, setCidNumber] = useState("");
  const [linkedCid, setLinkedCid] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pendingPaymentId, setPendingPaymentId] = useState("");
  const otpRef = useRef<HTMLInputElement>(null);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);

  // Auto-fill locked CID from user profile when modal opens
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
    if (status === "otp_required") setTimeout(() => otpRef.current?.focus(), 50);
  }, [status]);

  if (!isOpen) return null;

  const resetForm = () => {
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

  const canPay = !!linkedCid && cidNumber === linkedCid && status === "idle";

  const pollStatus = async (paymentId: string, initiatedPayment: PaymentResponse) => {
    const max = 30;
    let attempts = 0;
    const poll = async () => {
      try {
        const s = await checkDKBankPaymentStatus(paymentId);
        if (s.status === "success") {
          setStatus("success");
          setTimeout(() => { onClose(); resetForm(); onSuccess?.({ ...initiatedPayment, amount }); }, 2500);
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
        if (attempts < max) { attempts++; setTimeout(poll, 10000); }
        else { setError("Unable to verify payment"); setStatus("failed"); }
      }
    };
    poll();
  };

  const handlePay = async () => {
    if (!canPay) return;
    setStatus("processing");
    setError("");
    try {
      const req: DKBankPaymentRequest = {
        amount,
        customerPhone: cidNumber,
        customerName: customerName || undefined,
        description: `Predict: ${market.title} — ${outcome?.label}`,
        merchantTxnId: `TARA_BET_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      const payment = await initiateDKBankPayment(req);
      if (payment.otpRequired) {
        setPendingPaymentId(payment.paymentId);
        setStatus("otp_required");
      } else if (payment.status === "success") {
        setStatus("success");
        setTimeout(() => { onClose(); resetForm(); onSuccess?.({ ...payment, amount }); }, 2500);
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

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes successPop {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={{
        background: "var(--bg-card)",
        borderRadius: 20,
        width: "100%",
        maxWidth: 420,
        margin: "0 16px",
        boxSizing: "border-box",
        animation: "modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
        boxShadow: "var(--shadow-lg)",
      }}>

        {/* ── Success ── */}
        {status === "success" && (
          <div style={{ textAlign: "center", padding: "32px 24px 24px" }}>
            <div style={{ fontSize: 56, animation: "successPop 0.5s ease forwards", marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>Payment Confirmed!</div>
            <div style={{ fontSize: 13, color: "var(--text-subtle)" }}>Your bet on <strong style={{ color: "var(--text-main)" }}>{outcome?.label}</strong> has been placed.</div>
          </div>
        )}

        {/* ── Failed ── */}
        {status === "failed" && (
          <div style={{ padding: "20px 20px 20px" }}>
            <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid #fecaca", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 14, marginBottom: 4 }}>Payment Failed</div>
              <div style={{ fontSize: 13, color: "#ef4444" }}>{error}</div>
            </div>
            <button
              onClick={() => { setStatus("idle"); setError(""); }}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--bg-secondary)", color: "var(--text-muted)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── OTP Entry ── */}
        {status === "otp_required" && (
          <div style={{ padding: "20px 20px 20px" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-main)", marginBottom: 4 }}>Enter OTP</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              A one-time code was sent to your Telegram bot. Enter it below to confirm.
            </div>
            <input
              ref={otpRef}
              type="number"
              inputMode="numeric"
              placeholder="Enter OTP"
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box", padding: "14px", borderRadius: 12,
                border: "2px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-main)", fontSize: 22, fontWeight: 700,
                textAlign: "center", letterSpacing: "0.2em", outline: "none", marginBottom: 12,
              }}
            />
            {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
            <button
              onClick={handleConfirmOtp}
              disabled={otpValue.length < 4}
              style={{
                width: "100%", padding: "15px", borderRadius: 12, border: "none",
                background: otpValue.length >= 4 ? "#3b82f6" : "var(--bg-secondary)",
                color: otpValue.length >= 4 ? "#fff" : "var(--text-subtle)",
                fontSize: 15, fontWeight: 700, cursor: otpValue.length >= 4 ? "pointer" : "not-allowed",
              }}
            >
              Confirm OTP
            </button>
          </div>
        )}

        {/* ── Processing ── */}
        {status === "processing" && (
          <div style={{ textAlign: "center", padding: "32px 24px 32px" }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Processing payment...</div>
          </div>
        )}

        {/* ── Idle: Confirm screen ── */}
        {status === "idle" && (
          <div style={{ padding: "16px 20px 20px" }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text-main)", marginBottom: 16 }}>Confirm Payment</div>

            {/* Summary row */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Outcome</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{outcome?.label ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Amount</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#3b82f6" }}>{formatBTN(amount)}</span>
              </div>
            </div>

            {/* CID — locked if linked */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-subtle)", marginBottom: 6 }}>
                DK Bank CID
              </div>
              {linkedCid ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(22,163,74,0.1)", border: "1.5px solid #86efac", borderRadius: 12, padding: "12px 14px",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-main)", letterSpacing: "0.05em" }}>{linkedCid}</div>
                    {customerName && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{customerName}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                  No DK Bank account linked. Please link your account first.
                </div>
              )}
            </div>

            {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleClose}
                style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-muted)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={!canPay}
                style={{
                  flex: 2, padding: "14px", borderRadius: 12, border: "none",
                  background: canPay ? "#3b82f6" : "var(--bg-secondary)",
                  color: canPay ? "#fff" : "var(--text-subtle)",
                  fontSize: 15, fontWeight: 700, cursor: canPay ? "pointer" : "not-allowed",
                }}
              >
                {canPay ? `Pay ${formatBTN(amount)}` : "No linked account"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
