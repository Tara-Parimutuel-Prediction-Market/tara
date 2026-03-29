import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, XCircle } from "lucide-react";
import { PwaPaymentSelector } from "../components/PwaPaymentSelector";

const animationStyles = `
@keyframes slideInDown {
  from { opacity: 0; transform: translateY(-16px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bounceIcon {
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes shakeIcon {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
`;

export function PwaPaymentTestPage() {
  const [paymentResult, setPaymentResult] = useState<string>('');
  const [resultKey, setResultKey] = useState(0);
  const [testAmount] = useState(100); // 100 BTN

  const handlePaymentSuccess = (method: string) => {
    setPaymentResult(`✅ Payment successful using ${method}!`);
    setResultKey(k => k + 1);
  };

  const handlePaymentFailure = (error: string) => {
    setPaymentResult(`❌ Payment failed: ${error}`);
    setResultKey(k => k + 1);
  };

  const isSuccess = paymentResult.includes('✅');

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "20px 16px" }}>
      <style>{animationStyles}</style>
      <Link
        to="/"
        style={{
          color: "#6ab3f3",
          textDecoration: "none",
          fontSize: "0.9rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          marginBottom: "20px",
        }}
      >
        ← Back to Markets
      </Link>

      <div style={{
        backgroundColor: "#1a2332",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "16px",
      }}>
        <h1 style={{
          margin: "0 0 16px 0",
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#fff",
        }}>
          💳 Payment System Test
        </h1>

        <p style={{
          color: "#708499",
          fontSize: "0.9rem",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}>
          This page demonstrates the DK Bank payment integration for the Tara platform. 
          Select a payment method below to test the payment flow with staging credentials.
        </p>

        <div style={{
          backgroundColor: "#2a3a4a",
          padding: "16px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}>
          <h3 style={{
            margin: "0 0 8px 0",
            fontSize: "1rem",
            color: "#6ab3f3",
          }}>
            Test Configuration
          </h3>
          <div style={{ fontSize: "0.9rem", color: "#708499" }}>
            <div><strong>Amount:</strong> Nu. {testAmount}</div>
            <div><strong>Description:</strong> Test payment for Tara platform</div>
            <div><strong>Environment:</strong> Staging (DK Bank)</div>
          </div>
        </div>

        {paymentResult && (
          <div key={resultKey} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: isSuccess ? '#1a3a2a' : '#3a1a1a',
            border: `1px solid ${isSuccess ? '#4caf50' : '#ff4757'}`,
            color: '#fff',
            padding: '14px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            animation: 'slideInDown 0.3s ease forwards',
          }}>
            <span style={{ animation: isSuccess ? 'bounceIcon 0.45s ease forwards' : 'shakeIcon 0.4s ease forwards', display: 'flex', flexShrink: 0 }}>
              {isSuccess
                ? <CheckCircle size={22} color="#4caf50" />
                : <XCircle size={22} color="#ff4757" />}
            </span>
            <span>{isSuccess ? paymentResult.replace('✅ ', '') : paymentResult.replace('❌ ', '')}</span>
          </div>
        )}

        <PwaPaymentSelector
          amount={testAmount}
          description="Test payment for Tara platform"
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={handlePaymentFailure}
        />
      </div>

      <div style={{
        backgroundColor: "#1a2332",
        borderRadius: "12px",
        padding: "20px",
        marginTop: "16px",
      }}>
        <h2 style={{
          margin: "0 0 12px 0",
          fontSize: "1.2rem",
          fontWeight: 600,
          color: "#6ab3f3",
        }}>
          🏗️ Integration Status
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#4caf50' }}>✅ Backend DK Bank staging configuration</div>
          <div style={{ color: '#4caf50' }}>✅ Frontend payment types and interfaces</div>
          <div style={{ color: '#4caf50' }}>✅ PWA payment components</div>
          <div style={{ color: '#4caf50' }}>✅ TMA payment components</div>
          <div style={{ color: '#ffa500' }}>🔄 Backend payment module integration</div>
          <div style={{ color: '#ffa500' }}>🔄 End-to-end testing</div>
        </div>

        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#2a3a4a',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: '#708499',
        }}>
          <strong>Note:</strong> The payment system is using staging credentials. 
          No real money will be transferred. The DK Bank backend module needs to be 
          properly integrated for full functionality.
        </div>
      </div>
    </div>
  );
}
