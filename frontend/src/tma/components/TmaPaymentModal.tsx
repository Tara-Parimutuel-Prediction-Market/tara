import { useState } from 'react';
import { initiateDKBankPayment, confirmDKBankPayment, checkDKBankPaymentStatus, formatBTN, validateCID } from '@/api/dkbank';
import type { DKBankPaymentRequest, PaymentResponse } from '@/types/payment';

interface TmaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

type PaymentMethod = 'dkbank' | 'ton' | null;

export function TmaPaymentModal({
  isOpen,
  onClose,
  amount,
  description,
  onSuccess,
  onFailure,
}: TmaPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [cidNumber, setCidNumber] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'otp_required' | 'initiated' | 'checking' | 'success' | 'failed'>('idle');
  const [currentPayment, setCurrentPayment] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleInitiatePayment = async () => {
    if (!validateCID(cidNumber)) {
      setError('Enter a valid 11-digit CID number');
      return;
    }
    setIsProcessing(true);
    setError('');
    try {
      const paymentRequest: DKBankPaymentRequest = {
        amount,
        customerPhone: cidNumber,
        description,
        merchantTxnId: `TARA_TMA_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      const payment = await initiateDKBankPayment(paymentRequest);
      setCurrentPayment(payment);
      if (payment.otpRequired) {
        setPaymentStatus('otp_required');
      } else {
        setPaymentStatus('initiated');
        pollPaymentStatus(payment.paymentId);
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
      setPaymentStatus('failed');
      onFailure?.(err.message || 'Payment initiation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!otpValue || otpValue.length < 4) {
      setError('Enter the OTP sent to your registered phone');
      return;
    }
    if (!currentPayment) return;
    setIsProcessing(true);
    setError('');
    try {
      const confirmed = await confirmDKBankPayment(currentPayment.paymentId, otpValue);
      setCurrentPayment(confirmed);
      setPaymentStatus('initiated');
      pollPaymentStatus(confirmed.paymentId);
    } catch (err: any) {
      setError(err.message || 'OTP confirmation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const pollPaymentStatus = async (paymentId: string) => {
    const maxAttempts = 30;
    let attempts = 0;
    const poll = async () => {
      try {
        setPaymentStatus('checking');
        const status = await checkDKBankPaymentStatus(paymentId);
        if (status.status === 'success') {
          setPaymentStatus('success');
          onSuccess?.(currentPayment!);
          setTimeout(() => { onClose(); resetForm(); }, 2000);
        } else if (status.status === 'failed') {
          setPaymentStatus('failed');
          setError(status.failureReason || 'Payment failed');
          onFailure?.(status.failureReason || 'Payment failed');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setPaymentStatus('failed');
          setError('Payment verification timed out');
          onFailure?.('Payment verification timed out');
        }
      } catch {
        if (attempts < maxAttempts) { attempts++; setTimeout(poll, 10000); }
        else { setPaymentStatus('failed'); setError('Unable to verify payment status'); }
      }
    };
    poll();
  };

  const resetForm = () => {
    setSelectedMethod(null);
    setCidNumber('');
    setOtpValue('');
    setPaymentStatus('idle');
    setCurrentPayment(null);
    setError('');
  };

  const handleClose = () => {
    if (paymentStatus === 'initiated' || paymentStatus === 'checking') return;
    onClose();
    resetForm();
  };

  const step = paymentStatus === 'idle' ? 1 : paymentStatus === 'otp_required' ? 2 : 3;
  const canClose = paymentStatus === 'idle' || paymentStatus === 'success' || paymentStatus === 'failed' || paymentStatus === 'otp_required';
  const showingMethodSelector = selectedMethod === null && paymentStatus === 'idle';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'var(--tg-theme-bg-color, #1c1c1e)',
        borderRadius: '20px 20px 0 0',
        padding: '0',
        width: '100%',
        maxWidth: '480px',
        color: 'var(--tg-theme-text-color, #ffffff)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--tg-theme-hint-color, #555)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedMethod && (
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px',
              }}>
                {selectedMethod === 'dkbank' ? '' : '💎'}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>
                {showingMethodSelector ? 'Choose Payment' : selectedMethod === 'ton' ? 'TON Wallet' : 'DK Bank'}
              </div>
              {!showingMethodSelector && (
                <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                  {paymentStatus === 'otp_required' ? 'Verify OTP' :
                   paymentStatus === 'initiated' || paymentStatus === 'checking' ? 'Processing…' :
                   paymentStatus === 'success' ? 'Payment confirmed' :
                   paymentStatus === 'failed' ? 'Payment failed' : 'Secure payment'}
                </div>
              )}
            </div>
          </div>
          {canClose && (
            <button onClick={handleClose} style={{
              background: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
              border: 'none',
              color: 'var(--tg-theme-hint-color, #8e8e93)',
              width: '30px', height: '30px',
              borderRadius: '50%',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>✕</button>
          )}
        </div>

        {/* Amount pill */}
        {(paymentStatus === 'idle' || paymentStatus === 'otp_required') && (
          <div style={{ margin: '16px 20px 0', padding: '14px 16px', borderRadius: '12px', backgroundColor: 'var(--tg-theme-secondary-bg-color, #2c2c2e)' }}>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: '2px' }}>Amount</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--tg-theme-button-color, #2481cc)' }}>{formatBTN(amount)}</div>
            <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</div>
          </div>
        )}

        {/* Step dots — only when a method is selected and in DK Bank flow */}
        {!showingMethodSelector && selectedMethod === 'dkbank' && (paymentStatus === 'idle' || paymentStatus === 'otp_required') && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', margin: '14px 0 0' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                width: s === step ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: s <= step ? 'var(--tg-theme-button-color, #2481cc)' : 'var(--tg-theme-hint-color, #555)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>
        )}

        <div style={{ padding: '16px 20px 32px' }}>

          {/* ── Method selector ── */}
          {showingMethodSelector && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              {[
                { id: 'dkbank' as const, label: 'DK Bank', sub: 'Pay in BTN via OTP', icon: '', available: true },
                { id: 'ton' as const, label: 'TON Wallet', sub: 'Pay with USDT / TON', icon: '💎', available: false },
              ].map(({ id, label, sub, icon, available }) => (
                <button
                  key={id}
                  onClick={() => available && setSelectedMethod(id)}
                  disabled={!available}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px',
                    backgroundColor: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
                    border: '1.5px solid transparent',
                    borderRadius: '14px',
                    color: available ? 'var(--tg-theme-text-color, #fff)' : 'var(--tg-theme-hint-color, #8e8e93)',
                    cursor: available ? 'pointer' : 'not-allowed',
                    textAlign: 'left',
                    width: '100%',
                    opacity: available ? 1 : 0.55,
                  }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                    backgroundColor: 'var(--tg-theme-bg-color, #1c1c1e)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px',
                  }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: '2px' }}>
                      {available ? sub : 'Coming soon'}
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', color: 'var(--tg-theme-hint-color, #555)' }}>›</div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 1: CID entry ── */}
          {!showingMethodSelector && selectedMethod === 'dkbank' && paymentStatus === 'idle' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CID Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cidNumber}
                onChange={(e) => { setCidNumber(e.target.value.replace(/\D/g, '').slice(0, 11)); setError(''); }}
                placeholder="11-digit Citizenship ID"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
                  border: error ? '1.5px solid #ff453a' : '1.5px solid transparent',
                  borderRadius: '12px',
                  color: 'var(--tg-theme-text-color, #ffffff)',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: cidNumber ? '0.12em' : 'normal',
                }}
              />
              {cidNumber.length > 0 && cidNumber.length < 11 && (
                <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: '6px' }}>
                  {cidNumber.length}/11 digits
                </div>
              )}
              {error && <div style={{ fontSize: '13px', color: '#ff453a', marginTop: '8px' }}>{error}</div>}

              <button
                onClick={handleInitiatePayment}
                disabled={isProcessing || cidNumber.length !== 11}
                style={{
                  width: '100%',
                  padding: '15px',
                  marginTop: '16px',
                  backgroundColor: isProcessing || cidNumber.length !== 11
                    ? 'var(--tg-theme-hint-color, #555)'
                    : 'var(--tg-theme-button-color, #2481cc)',
                  color: 'var(--tg-theme-button-text-color, #ffffff)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: isProcessing || cidNumber.length !== 11 ? 'not-allowed' : 'pointer',
                  opacity: isProcessing || cidNumber.length !== 11 ? 0.6 : 1,
                }}
              >
                {isProcessing ? 'Sending OTP…' : 'Continue'}
              </button>
              <button
                onClick={() => { setSelectedMethod(null); setCidNumber(''); setError(''); }}
                style={{
                  width: '100%', padding: '12px', marginTop: '8px',
                  backgroundColor: 'transparent',
                  color: 'var(--tg-theme-hint-color, #8e8e93)',
                  border: 'none', borderRadius: '12px', fontSize: '14px', cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            </div>
          )}

          {/* ── Step 2: OTP entry ── */}
          {paymentStatus === 'otp_required' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>📲</div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>OTP Sent</div>
                <div style={{ fontSize: '13px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                  Enter the code sent to your DK Bank registered phone
                </div>
              </div>

              <input
                type="text"
                inputMode="numeric"
                value={otpValue}
                onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
                placeholder="- - - - - -"
                autoFocus
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: 'var(--tg-theme-secondary-bg-color, #2c2c2e)',
                  border: error ? '1.5px solid #ff453a' : '1.5px solid transparent',
                  borderRadius: '12px',
                  color: 'var(--tg-theme-text-color, #ffffff)',
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '0.3em',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {error && <div style={{ fontSize: '13px', color: '#ff453a', marginTop: '8px', textAlign: 'center' }}>{error}</div>}

              <button
                onClick={handleConfirmOtp}
                disabled={isProcessing || otpValue.length < 4}
                style={{
                  width: '100%',
                  padding: '15px',
                  marginTop: '16px',
                  backgroundColor: isProcessing || otpValue.length < 4
                    ? 'var(--tg-theme-hint-color, #555)'
                    : 'var(--tg-theme-button-color, #2481cc)',
                  color: 'var(--tg-theme-button-text-color, #ffffff)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: isProcessing || otpValue.length < 4 ? 'not-allowed' : 'pointer',
                  opacity: isProcessing || otpValue.length < 4 ? 0.6 : 1,
                }}
              >
                {isProcessing ? 'Confirming…' : `Pay ${formatBTN(amount)}`}
              </button>

              <button
                onClick={() => { setPaymentStatus('idle'); setOtpValue(''); setError(''); }}
                style={{
                  width: '100%',
                  padding: '12px',
                  marginTop: '8px',
                  backgroundColor: 'transparent',
                  color: 'var(--tg-theme-hint-color, #8e8e93)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                ← Change CID
              </button>
            </div>
          )}

          {/* ── Processing ── */}
          {(paymentStatus === 'initiated' || paymentStatus === 'checking') && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'pulse 1.5s infinite' }}>⏳</div>
              <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>Confirming Payment</div>
              <div style={{ fontSize: '13px', color: 'var(--tg-theme-hint-color, #8e8e93)' }}>
                DK Bank is processing your transaction…
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--tg-theme-button-color, #2481cc)', marginTop: '16px' }}>
                {formatBTN(amount)}
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {paymentStatus === 'success' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '56px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px', color: '#30d158' }}>Payment Confirmed</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '8px' }}>{formatBTN(amount)}</div>
              <div style={{ fontSize: '13px', color: 'var(--tg-theme-hint-color, #8e8e93)', marginTop: '6px' }}>Your bet has been placed</div>
            </div>
          )}

          {/* ── Failed ── */}
          {paymentStatus === 'failed' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: '56px', marginBottom: '12px' }}>❌</div>
              <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px', color: '#ff453a' }}>Payment Failed</div>
              <div style={{ fontSize: '13px', color: 'var(--tg-theme-hint-color, #8e8e93)', marginBottom: '20px' }}>
                {error || 'Something went wrong. Please try again.'}
              </div>
              <button
                onClick={() => { setPaymentStatus('idle'); setError(''); setOtpValue(''); }}
                style={{
                  width: '100%',
                  padding: '15px',
                  backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                  color: 'var(--tg-theme-button-text-color, #ffffff)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
