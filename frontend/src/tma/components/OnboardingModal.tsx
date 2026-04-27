import { useState } from "react";
import { TrendingUp, Target, Trophy, Wallet, ChevronRight, X } from "lucide-react";

const STORAGE_KEY = "oro_onboarding_done";

const STEPS = [
  {
    icon: <Wallet size={40} color="#a78bfa" />,
    title: "Set up your wallet",
    body: "Link your DK Bank account in the Wallet tab, deposit funds, and you're ready to predict. Takes under 2 minutes.",
    highlight: "Wallet → Link DK Bank → Deposit",
  },
  {
    icon: <TrendingUp size={40} color="#3b82f6" />,
    title: "Predict markets",
    body: "Pick outcomes on real-world events — sports, politics, crypto, and more. Earn Nu when you're right.",
  },
  {
    icon: <Target size={40} color="#22c55e" />,
    title: "Build your Oracle Score",
    body: "Every correct prediction improves your reputation. Rise from Rookie to Legend.",
  },
  {
    icon: <Trophy size={40} color="#f59e0b" />,
    title: "Compete weekly",
    body: "Weekly seasons reset the leaderboard. Invite friends for referral bonuses and daily streaks.",
  },
];

export function useOnboarding() {
  return typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY);
}

export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    onDone();
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-card, #1a1f2e)",
          borderRadius: 24,
          border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
          padding: "32px 24px 24px",
          position: "relative",
          textAlign: "center",
        }}
      >
        {/* Skip */}
        <button
          onClick={finish}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-subtle, #64748b)",
            padding: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div style={{ marginBottom: 20 }}>{s.icon}</div>

        {/* Step dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 99,
                background: i === step ? "#3b82f6" : "var(--glass-border, rgba(255,255,255,0.12))",
                transition: "width 0.25s ease",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "var(--text-main, #f8fafc)",
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          {s.title}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted, #94a3b8)",
            lineHeight: 1.6,
            margin: "0 0 12px",
            fontWeight: 500,
          }}
        >
          {s.body}
        </p>
        {"highlight" in s && s.highlight && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#a78bfa",
              marginBottom: 16,
              letterSpacing: "0.01em",
            }}
          >
            {s.highlight}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => (isLast ? finish() : setStep((n) => n + 1))}
          style={{
            width: "100%",
            padding: "14px",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            border: "none",
            borderRadius: 14,
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {isLast ? "Start predicting" : "Next"}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
