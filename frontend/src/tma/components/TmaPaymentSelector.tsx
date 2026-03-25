import { useState } from 'react';
import { TmaPaymentModal } from './TmaPaymentModal';
import type { PaymentMethod } from '@/types/payment';

interface TmaPaymentSelectorProps {
  amount: number;
  description: string;
  onPaymentSuccess?: (method: string) => void;
  onPaymentFailure?: (error: string) => void;
}

export function TmaPaymentSelector({
  amount,
  description,
  onPaymentSuccess,
  onPaymentFailure,
}: TmaPaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Telegram Mini App specific styles
  const containerStyles = {
    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '12px',
  };

  const amountDisplayStyles = {
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '12px',
  };

  const methodButtonStyles = (isSelected: boolean, isEnabled: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: isSelected ? 'var(--tg-theme-button-color, #007bff)' : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
    border: isSelected ? '2px solid var(--tg-theme-button-color, #007bff)' : '1px solid var(--tg-theme-hint-color, #cccccc)',
    borderRadius: '8px',
    color: isEnabled ? (isSelected ? 'var(--tg-theme-button-text-color, #ffffff)' : 'var(--tg-theme-text-color, #000000)') : 'var(--tg-theme-hint-color, #999999)',
    cursor: isEnabled ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s ease',
    marginBottom: '8px',
  });

  return (
    <>
      <div style={containerStyles}>
        <h4 style={{
          margin: '0 0 12px 0',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--tg-theme-text-color, #000000)',
        }}>
          Choose Payment Method
        </h4>

        <div style={amountDisplayStyles}>
          <div style={{ fontSize: '14px', color: 'var(--tg-theme-hint-color, #666666)', marginBottom: '4px' }}>Amount to Pay</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--tg-theme-button-color, #007bff)' }}>
            {paymentMethods.find(m => m.id === selectedMethod)?.currency === 'BTN' 
              ? `Nu. ${amount.toLocaleString()}`
              : paymentMethods.find(m => m.id === selectedMethod)?.currency === 'TON'
              ? `${amount} TON`
              : `${amount} Credits`
            }
          </div>
        </div>

        {paymentMethods.map((method) => (
          <button
            key={method.id}
            onClick={() => handlePaymentSelect(method.id)}
            disabled={!method.enabled}
            style={methodButtonStyles(selectedMethod === method.id, method.enabled)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                fontSize: '24px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedMethod === method.id ? 'rgba(255,255,255,0.2)' : 'var(--tg-theme-bg-color, #ffffff)',
                borderRadius: '8px',
              }}>
                {method.type === 'dkbank' && '🏦'}
                {method.type === 'ton' && '💎'}
                {method.type === 'credits' && '🪙'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{method.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--tg-theme-hint-color, #666666)', marginTop: '2px' }}>
                  Min: {method.minAmount} {method.currency}
                  {method.maxAmount && ` • Max: ${method.maxAmount} ${method.currency}`}
                </div>
              </div>
            </div>
            
            <div style={{
              fontSize: '18px',
              color: selectedMethod === method.id ? 'var(--tg-theme-button-text-color, #ffffff)' : 'var(--tg-theme-hint-color, #999999)',
            }}>
              {selectedMethod === method.id ? '✓' : '→'}
            </div>
          </button>
        ))}

        {!selectedMethod && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'var(--tg-theme-hint-color, #666666)',
            textAlign: 'center',
          }}>
            Select a payment method to continue
          </div>
        )}
      </div>

      <TmaPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        amount={amount}
        description={description}
        onSuccess={() => handlePaymentSuccess('dkbank')}
        onFailure={handlePaymentFailure}
      />
    </>
  );
}
