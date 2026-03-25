import { useState } from 'react';
import { PwaPaymentModal } from './PwaPaymentModal';
import type { PaymentMethod } from '@/types/payment';

interface PwaPaymentSelectorProps {
  amount: number;
  description: string;
  onPaymentSuccess?: (method: string) => void;
  onPaymentFailure?: (error: string) => void;
}

export function PwaPaymentSelector({
  amount,
  description,
  onPaymentSuccess,
  onPaymentFailure,
}: PwaPaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'dkbank',
      name: 'DK Bank',
      type: 'dkbank',
      currency: 'BTN',
      enabled: true,
      minAmount: 50,
      maxAmount: 10000,
    },
    {
      id: 'ton',
      name: 'TON Wallet',
      type: 'ton',
      currency: 'TON',
      enabled: true,
      minAmount: 0.5,
      maxAmount: 100,
    },
    {
      id: 'credits',
      name: 'Test Credits',
      type: 'credits',
      currency: 'CREDITS',
      enabled: true,
      minAmount: 1,
    },
  ];

  const handlePaymentSelect = (methodId: string) => {
    setSelectedMethod(methodId);
    
    if (methodId === 'dkbank') {
      setIsModalOpen(true);
    } else if (methodId === 'ton') {
      // TODO: Implement TON payment
      onPaymentFailure?.('TON payments coming soon');
    } else if (methodId === 'credits') {
      // TODO: Implement credits payment
      onPaymentFailure?.('Credits payments coming soon');
    }
  };

  const handlePaymentSuccess = (method: string) => {
    setIsModalOpen(false);
    onPaymentSuccess?.(method);
  };

  const handlePaymentFailure = (error: string) => {
    setIsModalOpen(false);
    onPaymentFailure?.(error);
  };

  return (
    <>
      <div style={{
        backgroundColor: '#1a2332',
        borderRadius: '12px',
        padding: '20px',
        marginTop: '16px',
      }}>
        <h4 style={{
          margin: '0 0 16px 0',
          fontSize: '1.1rem',
          fontWeight: 600,
          color: '#fff',
        }}>
          Choose Payment Method
        </h4>

        <div style={{
          backgroundColor: '#2a3a4a',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '0.9rem', color: '#708499', marginBottom: '4px' }}>Amount to Pay</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 600, color: '#6ab3f3' }}>
            {paymentMethods.find(m => m.id === selectedMethod)?.currency === 'BTN' 
              ? `Nu. ${amount.toLocaleString()}`
              : paymentMethods.find(m => m.id === selectedMethod)?.currency === 'TON'
              ? `${amount} TON`
              : `${amount} Credits`
            }
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => handlePaymentSelect(method.id)}
              disabled={!method.enabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: selectedMethod === method.id ? '#229ed9' : '#2a3a4a',
                border: selectedMethod === method.id ? '2px solid #6ab3f3' : '1px solid #3a4a5a',
                borderRadius: '8px',
                color: method.enabled ? '#fff' : '#708499',
                cursor: method.enabled ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  fontSize: '1.5rem',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selectedMethod === method.id ? '#6ab3f3' : '#3a4a5a',
                  borderRadius: '8px',
                }}>
                  {method.type === 'dkbank' && '🏦'}
                  {method.type === 'ton' && '💎'}
                  {method.type === 'credits' && '🪙'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>{method.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#708499', marginTop: '2px' }}>
                    Min: {method.minAmount} {method.currency}
                    {method.maxAmount && ` • Max: ${method.maxAmount} ${method.currency}`}
                  </div>
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
                      setBetAmount(amount);
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
                </div>
              </div>
              
              <div style={{
                fontSize: '1.2rem',
                color: selectedMethod === method.id ? '#fff' : '#708499',
              }}>
                {selectedMethod === method.id ? '✓' : '→'}
              </div>
            </button>
          ))}
        </div>

        {!selectedMethod && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#3a4a5a',
            borderRadius: '6px',
            fontSize: '0.9rem',
            color: '#708499',
            textAlign: 'center',
          }}>
            Select a payment method to continue
          </div>
        )}
      </div>

      <PwaPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        amount={amount}
        description={description}
        onSuccess={handleDkBankPayment}
        onFailure={handlePaymentFailure}
      />
    </>
  );
}
