import { useState } from "react";
import { Target, Swords, Lock, CheckCircle2, Medal } from "lucide-react";

// ── Collectible badge images ──────────────────────────────────────────────────
// Volume
import imgFirstCall from "../../assets/collectibles/volumebadges/firstcall.png";
import imgTripleThreat from "../../assets/collectibles/volumebadges/triplethreat.png";
import imgSharpStart from "../../assets/collectibles/volumebadges/sharpstart.png";
import imgTenDeep from "../../assets/collectibles/volumebadges/tendeep.png";
import imgCommitted from "../../assets/collectibles/volumebadges/committed.png";
import imgCenturion from "../../assets/collectibles/volumebadges/centurian.png";
// Accuracy
import imgAboveAverage from "../../assets/collectibles/accuraybadges/aboveaverage.png";
import imgEagleEye from "../../assets/collectibles/accuraybadges/eagleeye.png";
import imgSharpened from "../../assets/collectibles/accuraybadges/sharpened.png";
import imgOracle from "../../assets/collectibles/accuraybadges/oracle.png";
import imgElectrified from "../../assets/collectibles/accuraybadges/electrified.png";
import imgGodlike from "../../assets/collectibles/accuraybadges/godlike.png";
// Correct calls
import imgRightOnce from "../../assets/collectibles/correctcallsbadges/rightonce.png";
import imgDoubleDigit from "../../assets/collectibles/correctcallsbadges/doubledigit.png";
import imgThinkTank from "../../assets/collectibles/correctcallsbadges/thinktank.png";
import imgHalfCentury from "../../assets/collectibles/correctcallsbadges/halfcentury.png";
// Tiers
import imgRookie from "../../assets/collectibles/tierbadges/rookie.png";
import imgSharpshooter from "../../assets/collectibles/tierbadges/sharpshooter.png";
import imgHotHand from "../../assets/collectibles/tierbadges/hothand.png";
import imgLegend from "../../assets/collectibles/tierbadges/legend.png";
// Profile
import imgVerified from "../../assets/collectibles/profilebadges/verified.png";
import imgBankrolled from "../../assets/collectibles/profilebadges/bankrolled.png";
import imgConnected from "../../assets/collectibles/profilebadges/connected.png";
import imgHighScore from "../../assets/collectibles/profilebadges/highscore.png";
// Referral
import imgConnector from "../../assets/collectibles/referralbadges/connector.png";
import imgAmbassador from "../../assets/collectibles/referralbadges/ambassador.png";
import imgInfluencer from "../../assets/collectibles/referralbadges/influencer.png";
import imgKingmaker from "../../assets/collectibles/referralbadges/kingmaker.png";
// Duels
import imgChallenger from "../../assets/collectibles/duelbadges/challenger.png";
import imgOnFire from "../../assets/collectibles/duelbadges/onfire.png";
import imgDuelMaster from "../../assets/collectibles/duelbadges/duelmaster.png";
import imgDeadEye from "../../assets/collectibles/duelbadges/deadeye.png";
import imgPackLeader from "../../assets/collectibles/duelbadges/packleader.png";
import imgDuelOracle from "../../assets/collectibles/duelbadges/dueloracle.png";

// ── Types ─────────────────────────────────────────────────────────────────────

type CollectibleBadge = {
  id: string;
  img?: string; // image path — if present, renders instead of icon
  icon: React.ReactNode;
  name: string;
  /** What the user needs to do to unlock it */
  requirement: string;
  unlocked: boolean;
  legendary?: boolean; // special styling for the impossible one
};

// ── Badge definitions ─────────────────────────────────────────────────────────

export function buildBadges(
  total: number,
  correct: number,
  tier: string,
  score: number,
  hasPhone: boolean,
  hasDK: boolean,
  referrals: number,
): CollectibleBadge[] {
  const acc = total > 0 ? correct / total : 0;

  return [
    // ── Volume ──
    {
      id: "first_call",
      img: imgFirstCall,
      icon: <Target size={18} color="#3b82f6" />,
      name: "First Call",
      requirement: "Make your first prediction",
      unlocked: total >= 1,
    },
    {
      id: "triple",
      img: imgTripleThreat,
      icon: <Target size={18} color="#f97316" />,
      name: "Triple Threat",
      requirement: "Make 3 predictions",
      unlocked: total >= 3,
    },
    {
      id: "sharp_start",
      img: imgSharpStart,
      icon: <Target size={18} color="#eab308" />,
      name: "Sharp Start",
      requirement: "Make 5 predictions",
      unlocked: total >= 5,
    },
    {
      id: "ten_deep",
      img: imgTenDeep,
      icon: <Target size={18} color="#22c55e" />,
      name: "Ten Deep",
      requirement: "Make 10 predictions",
      unlocked: total >= 10,
    },
    {
      id: "committed",
      img: imgCommitted,
      icon: <Target size={18} color="#06b6d4" />,
      name: "Committed",
      requirement: "Make 25 predictions",
      unlocked: total >= 25,
    },
    {
      id: "centurion",
      img: imgCenturion,
      icon: <Target size={18} color="#a855f7" />,
      name: "Centurion",
      requirement: "Make 100 predictions",
      unlocked: total >= 100,
    },
    // ── Accuracy ──
    {
      id: "above_avg",
      img: imgAboveAverage,
      icon: <Target size={18} color="#3b82f6" />,
      name: "Above Average",
      requirement: "50%+ accuracy (5+ picks)",
      unlocked: total >= 5 && acc >= 0.5,
    },
    {
      id: "eagle_eye",
      img: imgEagleEye,
      icon: <Target size={18} color="#0ea5e9" />,
      name: "Eagle Eye",
      requirement: "60%+ accuracy (10+ picks)",
      unlocked: total >= 10 && acc >= 0.6,
    },
    {
      id: "sharpened",
      img: imgSharpened,
      icon: <Target size={18} color="#10b981" />,
      name: "Sharpened",
      requirement: "70%+ accuracy (15+ picks)",
      unlocked: total >= 15 && acc >= 0.7,
    },
    {
      id: "oracle",
      img: imgOracle,
      icon: <Target size={18} color="#8b5cf6" />,
      name: "Oracle",
      requirement: "75%+ accuracy (20+ picks)",
      unlocked: total >= 20 && acc >= 0.75,
    },
    {
      id: "electrified",
      img: imgElectrified,
      icon: <Target size={18} color="#f59e0b" />,
      name: "Electrified",
      requirement: "80%+ accuracy (30+ picks)",
      unlocked: total >= 30 && acc >= 0.8,
    },
    {
      id: "godlike",
      img: imgGodlike,
      icon: <Target size={18} color="#f59e0b" />,
      name: "Godlike",
      requirement: "85%+ accuracy (50+ picks)",
      unlocked: total >= 50 && acc >= 0.85,
    },
    // ── Correct calls ──
    {
      id: "right_once",
      img: imgRightOnce,
      icon: <CheckCircle2 size={18} color="#22c55e" />,
      name: "Right Once",
      requirement: "Get 1 correct prediction",
      unlocked: correct >= 1,
    },
    {
      id: "double_digit",
      img: imgDoubleDigit,
      icon: <Target size={18} color="#14b8a6" />,
      name: "Double Digit",
      requirement: "Get 10 correct predictions",
      unlocked: correct >= 10,
    },
    {
      id: "think_tank",
      img: imgThinkTank,
      icon: <Target size={18} color="#6366f1" />,
      name: "Think Tank",
      requirement: "Get 25 correct predictions",
      unlocked: correct >= 25,
    },
    {
      id: "half_century",
      img: imgHalfCentury,
      icon: <Target size={18} color="#ec4899" />,
      name: "Half Century",
      requirement: "Get 50 correct predictions",
      unlocked: correct >= 50,
    },
    // ── Tiers ──
    {
      id: "rookie",
      img: imgRookie,
      icon: <Target size={18} color="#84cc16" />,
      name: "Rookie",
      requirement: "Join Oro — you're already here!",
      unlocked: true,
    },
    {
      id: "sharpshooter",
      img: imgSharpshooter,
      icon: <Swords size={18} color="#3b82f6" />,
      name: "Sharpshooter",
      requirement: "Reach Sharpshooter tier",
      unlocked: ["sharpshooter", "hot_hand", "legend"].includes(tier),
    },
    {
      id: "hot_hand",
      img: imgHotHand,
      icon: <Target size={18} color="#ef4444" />,
      name: "Hot Hand",
      requirement: "Reach Hot Hand tier",
      unlocked: ["hot_hand", "legend"].includes(tier),
    },
    {
      id: "legend",
      img: imgLegend,
      icon: <Target size={18} color="#f59e0b" />,
      name: "Legend",
      requirement: "Reach Legend tier",
      unlocked: tier === "legend",
    },
    // ── Profile ──
    {
      id: "verified",
      img: imgVerified,
      icon: <Target size={18} color="#6366f1" />,
      name: "Verified",
      requirement: "Verify your phone via Oro bot",
      unlocked: hasPhone,
    },
    {
      id: "bankrolled",
      img: imgBankrolled,
      icon: <Target size={18} color="#0ea5e9" />,
      name: "Bankrolled",
      requirement: "Link your DK Bank account",
      unlocked: hasDK,
    },
    {
      id: "connected",
      img: imgConnected,
      icon: <Target size={18} color="#10b981" />,
      name: "Connected",
      requirement: "Link both phone and DK Bank",
      unlocked: hasPhone && hasDK,
    },
    {
      id: "high_score",
      img: imgHighScore,
      icon: <Target size={18} color="#f59e0b" />,
      name: "High Score",
      requirement: "Reach 70%+ reputation score",
      unlocked: score >= 0.7,
    },
    // ── Referrals ──
    {
      id: "ref_5",
      img: imgConnector,
      icon: <Target size={18} color="#22c55e" />,
      name: "Connector",
      requirement: "Refer 5 friends to Oro",
      unlocked: referrals >= 5,
    },
    {
      id: "ref_50",
      img: imgAmbassador,
      icon: <Target size={18} color="#3b82f6" />,
      name: "Ambassador",
      requirement: "Refer 50 friends to Oro",
      unlocked: referrals >= 50,
    },
    {
      id: "ref_100",
      img: imgInfluencer,
      icon: <Target size={18} color="#a855f7" />,
      name: "Influencer",
      requirement: "Refer 100 friends to Oro",
      unlocked: referrals >= 100,
    },
    // ── The impossible one ──
    {
      id: "ref_1000",
      img: imgKingmaker,
      icon: <Target size={20} color="#fff" />,
      name: "Kingmaker",
      requirement:
        "Refer 1,000 friends — unlocks an animated golden ring on your leaderboard profile",
      unlocked: referrals >= 1000,
      legendary: true,
    },
    // ── Duels ──
    {
      id: "duel_challenger",
      img: imgChallenger,
      icon: <Swords size={18} color="#f59e0b" />,
      name: "Challenger",
      requirement: "Get your 1st correct prediction",
      unlocked: correct >= 1,
    },
    {
      id: "duel_on_fire",
      img: imgOnFire,
      icon: <Target size={18} color="#f97316" />,
      name: "On Fire",
      requirement: "Get 3 correct predictions",
      unlocked: correct >= 3,
    },
    {
      id: "duel_master",
      img: imgDuelMaster,
      icon: <Target size={18} color="#eab308" />,
      name: "Duel Master",
      requirement: "Get 5 correct predictions",
      unlocked: correct >= 5,
    },
    {
      id: "duel_sharp",
      img: imgDeadEye,
      icon: <Target size={18} color="#22c55e" />,
      name: "Dead-Eye",
      requirement: "Get 10 correct predictions",
      unlocked: correct >= 10,
    },
    {
      id: "duel_pack",
      img: imgPackLeader,
      icon: <Target size={18} color="#3b82f6" />,
      name: "Pack Leader",
      requirement: "Make 25 total predictions",
      unlocked: total >= 25,
    },
    {
      id: "duel_oracle",
      img: imgDuelOracle,
      icon: <Target size={18} color="#a855f7" />,
      name: "Duel Oracle",
      requirement: "Get 25 correct predictions",
      unlocked: correct >= 25,
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BadgeGridProps {
  totalPredictions: number;
  correctPredictions: number;
  reputationTier: string;
  reputationScore: number;
  hasPhone: boolean;
  hasDKBank: boolean;
  /** Total accepted referrals — requires backend field `referralCount` on AuthUser */
  referralCount?: number;
}

export function BadgeGrid({
  totalPredictions,
  correctPredictions,
  reputationTier,
  reputationScore,
  hasPhone,
  hasDKBank,
  referralCount = 0,
}: BadgeGridProps) {
  const badges = buildBadges(
    totalPredictions,
    correctPredictions,
    reputationTier,
    reputationScore,
    hasPhone,
    hasDKBank,
    referralCount,
  );

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const total = badges.length;
  const [tapped, setTapped] = useState<string | null>(null);

  return (
    // Dismiss tooltip when tapping outside
    <div onClick={() => setTapped(null)}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Medal size={16} color="#f59e0b" />
          <span
            style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}
          >
            Collectibles
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: unlockedCount > 0 ? "#f59e0b" : "var(--text-subtle)",
            background:
              unlockedCount > 0
                ? "rgba(245,158,11,0.12)"
                : "var(--bg-secondary)",
            padding: "2px 10px",
            borderRadius: 99,
          }}
        >
          {unlockedCount}/{total} unlocked
        </span>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
          overflow: "visible",
        }}
      >
        {badges.map((b) => (
          <div
            key={b.id}
            onClick={(e) => {
              e.stopPropagation();
              setTapped((prev) => (prev === b.id ? null : b.id));
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
              position: "relative",
            }}
          >
            {/* Tooltip — shown on tap, always readable regardless of lock state */}
            {tapped === b.id && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: b.legendary
                    ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                    : "#1f2937",
                  border: b.legendary
                    ? "1px solid rgba(255,215,0,0.4)"
                    : "none",
                  color: "#f9fafb",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: 10,
                  zIndex: 20,
                  pointerEvents: "none",
                  boxShadow: b.legendary
                    ? "0 4px 20px rgba(255,215,0,0.25)"
                    : "0 4px 16px rgba(0,0,0,0.5)",
                  textAlign: "center",
                  width: 160,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: 3,
                    color: b.legendary ? "#ffd700" : "#fff",
                  }}
                >
                  {b.unlocked ? "✓ " : "🔒 "}
                  {b.name}
                </div>
                <div style={{ opacity: 0.85, fontSize: 10, lineHeight: 1.4 }}>
                  {b.unlocked ? "Unlocked!" : b.requirement}
                </div>
              </div>
            )}

            {/* Icon bubble */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: b.legendary ? 14 : 12,
                background: b.legendary
                  ? b.unlocked
                    ? "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)"
                    : "linear-gradient(135deg, #374151, #1f2937)"
                  : b.unlocked
                    ? "var(--bg-secondary)"
                    : "var(--bg-secondary)",
                border: b.legendary
                  ? b.unlocked
                    ? "2px solid #ffd700"
                    : "1.5px dashed #4b5563"
                  : b.unlocked
                    ? tapped === b.id
                      ? "1.5px solid #f59e0b"
                      : "1.5px solid #f59e0b44"
                    : "1.5px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow:
                  b.legendary && b.unlocked
                    ? "0 0 16px rgba(255,215,0,0.5)"
                    : b.unlocked
                      ? "0 0 8px rgba(245,158,11,0.18)"
                      : "none",
                opacity: b.unlocked ? 1 : 0.45,
                filter: b.unlocked ? "none" : "grayscale(0.7)",
                transition: "all 0.15s",
                animation:
                  b.legendary && b.unlocked
                    ? "legendaryPulse 2.5s ease-in-out infinite"
                    : "none",
              }}
            >
              {b.unlocked ? (
                b.img ? (
                  <img
                    src={b.img}
                    alt={b.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  b.icon
                )
              ) : (
                <Lock size={14} color="#6b7280" />
              )}
            </div>

            {/* Name — always readable, not faded out */}
            <span
              style={{
                fontSize: 9,
                fontWeight: b.legendary ? 800 : 600,
                color:
                  b.legendary && b.unlocked
                    ? "#f59e0b"
                    : tapped === b.id
                      ? "var(--text-main)"
                      : "var(--text-subtle)",
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: 44,
                transition: "color 0.15s",
              }}
            >
              {b.name}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes legendaryPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(255,215,0,0.4); }
          50%       { box-shadow: 0 0 22px rgba(255,215,0,0.75); }
        }
      `}</style>
    </div>
  );
}
