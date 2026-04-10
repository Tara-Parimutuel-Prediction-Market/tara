import { FC } from "react";
import { X, Flame, Zap, Trophy, ShieldCheck, Star } from "lucide-react";

interface StreakBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakCount: number;
}

export const StreakBenefitsModal: FC<StreakBenefitsModalProps> = ({
  isOpen,
  onClose,
  streakCount,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes torchPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes fireGlow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.4)); }
          50% { filter: drop-shadow(0 0 15px rgba(249, 115, 22, 0.6)); }
        }
      `}</style>
      
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "linear-gradient(135deg, #1e293b, #0f172a)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          position: "relative",
          animation: "modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative background glow */}
        <div style={{
          position: "absolute",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "120%",
          height: 150,
          background: "radial-gradient(circle, rgba(239, 68, 68, 0.15), transparent 70%)",
          pointerEvents: "none",
        }} />

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.6)",
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          <X size={18} />
        </button>

        <div style={{ padding: "32px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ 
              display: "inline-flex", 
              position: "relative",
              marginBottom: 16,
              animation: "fireGlow 2s ease-in-out infinite"
            }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: "linear-gradient(135deg, #ef4444, #f97316)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(4deg)",
              }}>
                <Flame size={44} color="#fff" fill="#fff" style={{ animation: "torchPulse 2s ease-in-out infinite", transform: "rotate(-4deg)" }} />
              </div>
              <div style={{
                position: "absolute",
                bottom: -8,
                right: -8,
                background: "#fff",
                color: "#0f172a",
                borderRadius: 12,
                padding: "4px 8px",
                fontSize: 18,
                fontWeight: 900,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}>
                {streakCount}
              </div>
            </div>
            
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
              Streak Rewards
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              Bet daily to maintain your fire and unlock exclusive bonuses.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <BenefitRow 
              icon={<Zap size={20} color="#fbbf24" />}
              title="Day 7 Booster"
              description="Reach a 7-day streak for a 1.2× payout boost on all wins that day."
            />
            <BenefitRow 
              icon={<Trophy size={20} color="#60a5fa" />}
              title="Reputation Surge"
              description="Streaks accelerate your journey to Legendary status."
            />
            <BenefitRow 
              icon={<ShieldCheck size={20} color="#34d399" />}
              title="Dispute Power"
              description="Longer streaks give your votes more weight in market disputes."
            />
            <BenefitRow 
              icon={<Star size={20} color="#c084fc" />}
              title="Exclusive Drops"
              description="Maintain 14+ days for early access to new market sectors."
            />
          </div>

          <button
            onClick={onClose}
            style={{
              marginTop: 32,
              width: "100%",
              padding: "16px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            Keep it burning!
          </button>
        </div>
      </div>
    </div>
  );
};

const BenefitRow = ({ icon, title, description }: { icon: any, title: string, description: string }) => (
  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
    <div style={{ 
      width: 40, 
      height: 40, 
      borderRadius: 12, 
      background: "rgba(255,255,255,0.05)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      flexShrink: 0 
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{description}</div>
    </div>
  </div>
);
