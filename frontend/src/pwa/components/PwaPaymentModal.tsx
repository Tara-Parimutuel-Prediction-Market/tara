import React, { useState } from 'react';
import { initiateDKBankPayment, checkDKBankPaymentStatus, formatBTN, validateBhutanesePhone } from '@/api/dkbank';
import type { DKBankPaymentRequest, PaymentResponse, PaymentStatus } from '@/types/payment';

interface PwaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  onSuccess?: (payment: PaymentResponse) => void;
  onFailure?: (error: string) => void;
}

export function PwaPaymentModal({
  isOpen,
  onClose,
  amount,
  description,
  onSuccess,
  onFailure,
}: PwaPaymentModalProps) {
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
        merchantTxnId: `TARA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    const maxAttempts = 30; // Poll for 5 minutes max
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
          }, 3000);
        } else if (status.status === 'failed') {
          setPaymentStatus('failed');
          setError(status.failureReason || 'Payment failed');
          onFailure?.(status.failureReason || 'Payment failed');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 10000); // Poll every 10 seconds
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
      // Don't close while payment is being processed
      return;
    }
    onClose();
    resetForm();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1a2332',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '400px',
        color: '#fff',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
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
                color: '#708499',
                fontSize: '1.5rem',
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
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#2a3a4a', 
                padding: '16px', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#708499', marginBottom: '4px' }}>Amount</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#6ab3f3' }}>
                  {formatBTN(amount)}
                </div>
              </div>
              
              <div style={{ fontSize: '0.9rem', color: '#708499', marginBottom: '16px' }}>
                {description}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#708499' }}>
                Phone Number *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+975 17xxxxxx"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#2a3a4a',
                  border: '1px solid #3a4a5a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#708499' }}>
                Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#2a3a4a',
                  border: '1px solid #3a4a5a',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '1rem',
                }}
              />
            </div>

            {error && (
              <div style={{
                backgroundColor: '#ff4757',
                color: '#fff',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.9rem',
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleInitiatePayment}
              disabled={isProcessing || !phoneNumber}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: isProcessing || !phoneNumber ? '#3a4a5a' : '#229ed9',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: isProcessing || !phoneNumber ? 'not-allowed' : 'pointer',
              }}
            >
              {isProcessing ? 'Processing...' : 'Pay with DK Bank'}
            </button>
          </div>
        )}

        {(paymentStatus === 'initiated' || paymentStatus === 'checking') && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#6ab3f3' }}>Payment Initiated</h4>
            <p style={{ margin: '0 0 16px 0', color: '#708499', fontSize: '0.9rem' }}>
              Please check your DK Bank mobile app to complete the payment
            </p>
            <div style={{
              backgroundColor: '#2a3a4a',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#708499',
            }}>
              Verifying payment status...
            </div>
          </div>
        )}

        {paymentStatus === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#4caf50' }}>Payment Successful!</h4>
            <p style={{ margin: '0', color: '#708499', fontSize: '0.9rem' }}>
              Your payment has been confirmed
            </p>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
            <h4 style={{ margin: '0 0 8px 0', color: '#ff4757' }}>Payment Failed</h4>
            <p style={{ margin: '0 0 16px 0', color: '#708499', fontSize: '0.9rem' }}>
              {error || 'Payment could not be completed'}
            </p>
            <button
              onClick={() => {
                setPaymentStatus('idle');
                setError('');
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#229ed9',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
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
  );
}
