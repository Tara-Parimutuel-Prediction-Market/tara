import { useState, useRef, useEffect } from 'react';
import { initiateDKBankPayment, checkDKBankPaymentStatus, formatBTN } from '@/api/dkbank';
import { loginWithDKBank } from '@/api/client';
import type { Market } from '@/api/client';
import type { DKBankPaymentRequest, PaymentResponse } from '@/types/payment';

const QUICK_AMOUNTS = [50, 100, 200, 500];
const MIN_BET = 50;

interface PwaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  outcomeId: string;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

type Status = 'idle' | 'processing' | 'success' | 'failed';

export function PwaPaymentModal({
  isOpen,
  onClose,
  market,
  outcomeId,
  onSuccess,
  onFailure,
}: PwaPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'dkbank' | null>(null);
  const [amountStr, setAmountStr] = useState('100');
  const [cidNumber, setCidNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  const betAmount = parseFloat(amountStr) || 0;
  const isValidAmount = betAmount >= MIN_BET;
  const canPay = isValidAmount && cidNumber.length === 11 && status === 'idle' && selectedMethod === 'dkbank';

  const estPayout = (() => {
    if (!isValidAmount || !outcome) return 0;
    const houseEdge = parseFloat(market.houseEdgePct) || 0;
    const outcomePool = Number(outcome.totalBetAmount) + betAmount;
    const totalPool = Number(market.totalPool) + betAmount;
    if (outcomePool <= 0) return 0;
    return betAmount * (totalPool * (1 - houseEdge / 100) / outcomePool);
  })();
  const estProfit = estPayout - betAmount;

  useEffect(() => {
    if (selectedMethod === 'dkbank') setTimeout(() => inputRef.current?.focus(), 50);
  }, [selectedMethod]);

  if (!isOpen) return null;

  const resetForm = () => {
    setSelectedMethod(null);
    setAmountStr('100');
    setCidNumber('');
    setCustomerName('');
    setStatus('idle');
    setError('');
  };

  const handleClose = () => {
    if (status === 'processing') return;
    onClose();
    resetForm();
  };

  const handlePay = async () => {
    if (!canPay) return;
    setStatus('processing');
    setError('');
    try {
      await loginWithDKBank(cidNumber);
      const req: DKBankPaymentRequest = {
        amount: betAmount,
        customerPhone: cidNumber,
        customerName: customerName || undefined,
        description: `Predict: ${market.title} — ${outcome?.label}`,
        merchantTxnId: `TARA_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      };
      const payment = await initiateDKBankPayment(req);
      if (payment.status === 'success') {
        setStatus('success');
        onSuccess?.({ ...payment, amount: betAmount });
        setTimeout(() => { onClose(); resetForm(); }, 2500);
      } else {
        pollStatus(payment.paymentId);
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      setStatus('failed');
      onFailure?.(err.message || 'Payment failed');
    }
  };

  const pollStatus = async (paymentId: string) => {
    const max = 30;
    let attempts = 0;
    const poll = async () => {
      try {
        const s = await checkDKBankPaymentStatus(paymentId);
        if (s.status === 'success') {
          setStatus('success');
          onSuccess?.({ ...(currentPayment!), amount: betAmount });
          setTimeout(() => { onClose(); resetForm(); }, 2500);
        } else if (s.status === 'failed') {
          setError(s.failureReason || 'Payment failed');
          setStatus('failed');
          onFailure?.(s.failureReason || 'Payment failed');
        } else if (attempts < max) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setError('Payment verification timeout');
          setStatus('failed');
          onFailure?.('Payment verification timeout');
        }
      } catch {
        if (attempts < max) { attempts++; setTimeout(poll, 10000); }
        else { setError('Unable to verify payment'); setStatus('failed'); }
      }
    };
    poll();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: '#ffffff', borderRadius: 20,
        padding: '24px 20px 28px',
        width: '100%', maxWidth: 460, margin: '0 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>

        {/* ── Result screens ──────────────────────────────────────────────── */}
        {status === 'success' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', marginBottom: 6 }}>Bet Placed!</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Your payment was confirmed</div>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>Payment Failed</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{error || 'Could not complete payment'}</div>
            <button
              onClick={() => { setStatus('idle'); setError(''); }}
              style={{ padding: '12px 28px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Main form ───────────────────────────────────────────────────── */}
        {(status === 'idle' || status === 'processing') && (<>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Placing a bet on
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.3, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {market.title}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 20, padding: '4px 12px',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>{outcome?.label}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: '#f3f4f6', border: 'none', borderRadius: '50%',
                width: 30, height: 30, fontSize: 18, color: '#6b7280',
                cursor: status === 'processing' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >×</button>
          </div>

          <div style={{ height: 1, background: '#f3f4f6', marginBottom: 16 }} />

          {/* Payment method */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Pay with
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setSelectedMethod('dkbank')}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: selectedMethod === 'dkbank' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                background: selectedMethod === 'dkbank' ? '#eff6ff' : '#f9fafb',
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18 }}>🏦</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedMethod === 'dkbank' ? '#1d4ed8' : '#374151' }}>DK Bank</div>
                <div style={{ fontSize: 11, color: selectedMethod === 'dkbank' ? '#60a5fa' : '#9ca3af' }}>BTN · Nu</div>
              </div>
            </button>
            <div style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: '2px solid #f3f4f6', background: '#fafafa',
              display: 'flex', alignItems: 'center', gap: 8, opacity: 0.45,
            }}>
              <span style={{ fontSize: 18 }}>💎</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af' }}>TON Wallet</div>
                <div style={{ fontSize: 11, color: '#d1d5db' }}>Coming soon</div>
              </div>
            </div>
          </div>

          {/* Amount + CID — shown only after method is selected */}
          {selectedMethod === 'dkbank' && (<>
            <div style={{ height: 1, background: '#f3f4f6', marginBottom: 16 }} />

            {/* Amount */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Amount (Nu)
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmountStr(q.toString())}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 10,
                    border: amountStr === q.toString() ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                    background: amountStr === q.toString() ? '#eff6ff' : '#f9fafb',
                    color: amountStr === q.toString() ? '#3b82f6' : '#374151',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >{q}</button>
              ))}
            </div>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: '#9ca3af', pointerEvents: 'none' }}>Nu</span>
              <input
                ref={inputRef}
                type="number"
                min={MIN_BET}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px 12px 34px', borderRadius: 10,
                  border: isValidAmount || !betAmount ? '2px solid #e5e7eb' : '2px solid #fca5a5',
                  fontSize: 15, fontWeight: 600, color: '#111827',
                  background: '#f9fafb', outline: 'none',
                }}
              />
            </div>

            {/* Estimated payout */}
            {isValidAmount && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: estProfit >= 0 ? '#f0fdf4' : '#f9fafb',
                border: `1px solid ${estProfit >= 0 ? '#86efac' : '#e5e7eb'}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Est. payout if win
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: estProfit >= 0 ? '#16a34a' : '#9ca3af' }}>
                    {estProfit >= 0 ? `Nu ${estPayout.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Est. profit
                  </div>
                  {estProfit >= 0 ? (
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>
                      +Nu {estProfit.toFixed(2)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#9ca3af', maxWidth: 120, textAlign: 'right' }}>
                      Grows as more bets join
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CID */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                CID Number *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cidNumber}
                onChange={(e) => setCidNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="11-digit CID"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 10,
                  border: '2px solid #e5e7eb',
                  fontSize: 15, fontWeight: 600, color: '#111827',
                  background: '#f9fafb', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 10,
                  border: '2px solid #e5e7eb',
                  fontSize: 15, fontWeight: 600, color: '#111827',
                  background: '#f9fafb', outline: 'none',
                }}
              />
            </div>
          </>)}

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              color: '#ef4444', padding: '10px 14px', borderRadius: 8,
              marginBottom: 16, fontSize: 13, fontWeight: 500,
            }}>{error}</div>
          )}

          <button
            onClick={handlePay}
            disabled={!canPay}
            style={{
              width: '100%', padding: '14px',
              background: canPay ? '#3b82f6' : '#e5e7eb',
              color: canPay ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: canPay ? 'pointer' : 'not-allowed',
            }}
          >
            {status === 'processing'
              ? 'Processing…'
              : canPay
                ? `Pay ${formatBTN(betAmount)} with DK Bank`
                : !isValidAmount ? `Min Nu ${MIN_BET}` : 'Enter CID to continue'}
          </button>
        </>)}
      </div>
    </div>
  );
}
