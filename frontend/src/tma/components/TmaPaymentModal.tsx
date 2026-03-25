import { useState } from 'react';
import { initiateDKBankPayment, checkDKBankPaymentStatus, formatBTN, validateBhutanesePhone } from '@/api/dkbank';
import type { DKBankPaymentRequest, PaymentResponse } from '@/types/payment';

interface TmaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

export function TmaPaymentModal({
  isOpen,
  onClose,
  amount,
  description,
  onSuccess,
  onFailure,
}: TmaPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'initiated' | 'checking' | 'success' | 'failed'>('idle');
  const [currentPayment, setCurrentPayment] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleInitiatePayment = async () => {
    // Validate phone number
    if (!validateBhutanesePhone(phoneNumber)) {
      setError('Please enter a valid Bhutanese phone number (+975 17xxxxxx or +975 77xxxxxx)');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const paymentRequest: DKBankPaymentRequest = {
        amount,
        customerPhone: phoneNumber,
        customerName: customerName || undefined,
        description,
        merchantTxnId: `TARA_TMA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      const payment = await initiateDKBankPayment(paymentRequest);
      setCurrentPayment(payment);
      setPaymentStatus('initiated');

      // Start polling for payment status
      pollPaymentStatus(payment.paymentId);
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
      setPaymentStatus('failed');
      onFailure?.(err.message || 'Payment initiation failed');
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
          setTimeout(() => {
            onClose();
            resetForm();
          }, 2000);
        } else if (status.status === 'failed') {
          setPaymentStatus('failed');
          setError(status.failureReason || 'Payment failed');
          onFailure?.(status.failureReason || 'Payment failed');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setPaymentStatus('failed');
          setError('Payment verification timeout');
          onFailure?.('Payment verification timeout');
        }
      } catch (err: any) {
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 10000);
        } else {
          setPaymentStatus('failed');
          setError('Unable to verify payment status');
          onFailure?.('Unable to verify payment status');
        }
      }
    };

    poll();
  };

  const resetForm = () => {
    setPhoneNumber('');
    setCustomerName('');
    setPaymentStatus('idle');
    setCurrentPayment(null);
    setError('');
  };

  const handleClose = () => {
    if (paymentStatus === 'initiated' || paymentStatus === 'checking') {
      return;
    }
    onClose();
    resetForm();
  };

  // Telegram Mini App specific styles
  const modalStyles = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  };

  const contentStyles = {
    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
    borderRadius: '12px',
    padding: '20px',
    width: '100%',
    maxWidth: '400px',
    color: 'var(--tg-theme-text-color, #000000)',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
  };

  const inputStyles = {
    width: '100%',
    padding: '12px',
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
    border: '1px solid var(--tg-theme-hint-color, #cccccc)',
    borderRadius: '8px',
    color: 'var(--tg-theme-text-color, #000000)',
    fontSize: '16px',
  };

  const buttonStyles = {
    width: '100%',
    padding: '14px',
    backgroundColor: 'var(--tg-theme-button-color, #007bff)',
    color: 'var(--tg-theme-button-text-color, #ffffff)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div style={modalStyles}>
      <div style={contentStyles}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            {paymentStatus === 'success' ? '✅ Payment Successful' : 
             paymentStatus === 'failed' ? '❌ Payment Failed' : 
             '🏦 DK Bank Payment'}
          </h3>
          {(paymentStatus === 'idle' || paymentStatus === 'success' || paymentStatus === 'failed') && (
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--tg-theme-hint-color, #999999)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '30px',
                height: '30px',
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Content based on status */}
        {paymentStatus === 'idle' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color, #666666)', marginBottom: '4px' }}>Amount</div>
                <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--tg-theme-button-color, #007bff)' }}>
                  {formatBTN(amount)}
                </div>
              </div>
              
              <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color, #666666)', marginBottom: '16px' }}>
                {description}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--tg-theme-hint-color, #666666)' }}>
                Phone Number *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+975 17xxxxxx"
                style={inputStyles}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--tg-theme-hint-color, #666666)' }}>
                Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                style={inputStyles}
              />
            </div>

            {error && (
              <div style={{
                backgroundColor: '#ff4757',
                color: '#ffffff',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleInitiatePayment}
              disabled={isProcessing || !phoneNumber}
              style={{
                ...buttonStyles,
                backgroundColor: isProcessing || !phoneNumber ? 'var(--tg-theme-hint-color, #cccccc)' : 'var(--tg-theme-button-color, #007bff)',
                cursor: isProcessing || !phoneNumber ? 'not-allowed' : 'pointer',
              }}
            >
              {isProcessing ? 'Processing...' : 'Pay with DK Bank'}
            </button>
          </div>
        )}

        {(paymentStatus === 'initiated' || paymentStatus === 'checking') && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--tg-theme-button-color, #007bff)' }}>Payment Initiated</h4>
            <p style={{ margin: '0 0 16px 0', color: 'var(--tg-theme-hint-color, #666666)', fontSize: '14px' }}>
              Please check your DK Bank mobile app to complete the payment
            </p>
            <div style={{
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--tg-theme-hint-color, #666666)',
            }}>
              Verifying payment status...
            </div>
          </div>
        )}

        {paymentStatus === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#4caf50' }}>Payment Successful!</h4>
            <p style={{ margin: '0', color: 'var(--tg-theme-hint-color, #666666)', fontSize: '14px' }}>
              Your payment has been confirmed
            </p>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#ff4757' }}>Payment Failed</h4>
            <p style={{ margin: '0 0 16px 0', color: 'var(--tg-theme-hint-color, #666666)', fontSize: '14px' }}>
              {error || 'Payment could not be completed'}
            </p>
            <button
              onClick={() => {
                setPaymentStatus('idle');
                setError('');
              }}
              style={buttonStyles}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
