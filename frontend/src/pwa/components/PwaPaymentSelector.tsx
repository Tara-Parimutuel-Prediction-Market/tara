import { useState } from "react";
import type { PaymentMethod } from "@/types/payment";

interface PwaPaymentSelectorProps {
  amount: number;
  description: string;
  onPaymentSuccess?: (method: string) => void;
  onPaymentFailure?: (error: string) => void;
}

export function PwaPaymentSelector({
  amount,
  onPaymentFailure,
}: PwaPaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  const paymentMethods: PaymentMethod[] = [
    {
      id: "dkbank",
      name: "DK Bank",
      type: "dkbank",
      currency: "BTN",
      enabled: true,
      minAmount: 100,
      maxAmount: 15000,
    },
    {
      id: "ton",
      name: "TON Wallet",
      type: "ton",
      currency: "USDT",
      enabled: true,
      minAmount: 0.5,
      maxAmount: 100,
    },
    {
      id: "credits",
      name: "Test Credits",
      type: "credits",
      currency: "CREDITS",
      enabled: true,
      minAmount: 1,
    },
  ];

  const handlePaymentSelect = (methodId: string) => {
    setSelectedMethod(methodId);
    if (methodId === "ton") {
      onPaymentFailure?.("TON payments coming soon");
    } else if (methodId === "credits") {
      onPaymentFailure?.("Credits payments coming soon");
    }
  };

  return (
    <>
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          marginTop: "var(--space-md)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h4
          style={{
            margin: "0 0 var(--space-md) 0",
            fontSize: "1.2rem",
            fontWeight: 800,
            color: "var(--text-main)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
          }}
        >
          Choose Payment Method
        </h4>

        <div
          style={{
            backgroundColor: "var(--bg-secondary)",
            padding: "var(--space-md)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-md)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginBottom: "var(--space-xs)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Total Amount
          </div>
          <div
            style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--color-primary)", letterSpacing: "-0.02em" }}
          >
            Nu {amount.toLocaleString()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {paymentMethods.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => handlePaymentSelect(method.id)}
                disabled={!method.enabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-md)",
                  backgroundColor: isSelected ? "var(--bg-card)" : "var(--bg-card)",
                  border: isSelected
                    ? "2px solid var(--color-primary)"
                    : "1.5px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: method.enabled ? "var(--text-main)" : "var(--text-subtle)",
                  cursor: method.enabled ? "pointer" : "not-allowed",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: isSelected ? "var(--shadow-md)" : "none",
                  transform: isSelected ? "scale(1.02)" : "scale(1)",
                }}
                onMouseEnter={(e) => {
                  if (method.enabled && !isSelected) {
                    e.currentTarget.style.borderColor = "var(--text-subtle)";
                    e.currentTarget.style.transform = "scale(1.01)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (method.enabled && !isSelected) {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.transform = "scale(1)";
                  }
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}
                >
                  <div
                    style={{
                      fontSize: "1.5rem",
                      width: "44px",
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? "var(--color-primary)" : "var(--bg-secondary)",
                      borderRadius: "var(--radius-sm)",
                      transition: "all 0.2s",
                      boxShadow: isSelected ? "0 4px 10px rgba(39, 117, 208, 0.3)" : "none",
                    }}
                  >
                    {method.type === "dkbank" && (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#fff" : "var(--text-muted)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                      </svg>
                    )}
                    {method.type === "ton" && "💎"}
                    {method.type === "credits" && "🪙"}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.01em" }}>
                      {method.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        marginTop: "2px",
                        fontWeight: 600,
                      }}
                    >
                      Min: {method.minAmount} {method.currency}
                      {method.maxAmount &&
                        ` • Max: ${method.maxAmount} ${method.currency}`}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: isSelected ? "var(--color-primary)" : "transparent",
                    border: isSelected ? "none" : "2px solid var(--border)",
                    color: isSelected ? "#fff" : "transparent",
                    transition: "all 0.2s",
                  }}
                >
                  {isSelected ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {!selectedMethod && (
          <div
            style={{
              marginTop: "var(--space-md)",
              padding: "var(--space-sm) var(--space-md)",
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              color: "var(--color-warning)",
              textAlign: "center",
              fontWeight: 700,
              border: "1px solid rgba(245, 158, 11, 0.2)",
            }}
          >
            Please select a payment method to continue
          </div>
        )}
      </div>
    </>
  );
}
