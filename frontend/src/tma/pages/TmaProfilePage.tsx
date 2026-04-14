import { FC, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/tma/hooks/useAuth";
import { getMe, getReferralStats, AuthUser, type ReferralStats } from "@/api/client";
import { Page } from "@/tma/components/Page";
import { StreakBenefitsModal } from "@/tma/components/StreakBenefitsModal";
import { ProfileShareCard } from "@/tma/components/ProfileShareCard";
import { BadgeGrid, buildBadges } from "@/tma/components/BadgeGrid";
import {
  Trophy,
  Flame,
  Swords,
  Sprout,
  Settings,
  UserPlus,
  Medal,
  Share2,
  Target,
  TrendingUp,
  X,
  Wallet,
  ChevronRight,
} from "lucide-react";

export const TmaProfilePage: FC = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [freshUser, setFreshUser] = useState<AuthUser | null>(null);
  const [freshLoading, setFreshLoading] = useState(true);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [showProfileShare, setShowProfileShare] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);

  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));
    getReferralStats()
      .then(setReferralStats)
      .catch(() => undefined);
  }, []);

  const user = freshUser ?? authUser;
  const loading = authLoading && freshLoading;

  if (loading) {
    return (
      <Page>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <div style={spinner} />
        </div>
      </Page>
    );
  }

  const tier = user?.reputationTier ?? "rookie";
  const tierLabel = tier === "legend" ? "Legend" : tier === "hot_hand" ? "Hot Hand" : tier === "sharpshooter" ? "Sharpshooter" : "Rookie";
  const tierBg = tier === "legend" ? "rgba(245,158,11,0.25)" : tier === "hot_hand" ? "rgba(16,185,129,0.25)" : tier === "sharpshooter" ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.12)";
  const tierColor = tier === "legend" ? "#fbbf24" : tier === "hot_hand" ? "#6ee7b7" : tier === "sharpshooter" ? "#93c5fd" : "rgba(255,255,255,0.6)";
  const tierBorder = tier === "legend" ? "rgba(245,158,11,0.4)" : tier === "hot_hand" ? "rgba(16,185,129,0.4)" : tier === "sharpshooter" ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.2)";
  const tierIcon = tier === "legend" ? <Trophy size={11} /> : tier === "hot_hand" ? <Flame size={11} /> : tier === "sharpshooter" ? <Swords size={11} /> : <Sprout size={11} />;

  const badgeColor = user?.contrarianBadge === "gold" ? "#f59e0b" : user?.contrarianBadge === "silver" ? "#94a3b8" : user?.contrarianBadge ? "#b45309" : null;

  const winRate = (user?.totalPredictions ?? 0) > 0
    ? Math.round(((user?.correctPredictions ?? 0) / (user?.totalPredictions ?? 1)) * 100)
    : 0;

  const repScore = Math.round(Number(user?.reputationScore ?? 0) * 100);

  const total = user?.totalPredictions ?? 0;
  const correct = user?.correctPredictions ?? 0;
  const acc = total > 0 ? correct / total : 0;
  const badges = buildBadges(total, correct, tier, Number(user?.reputationScore ?? 0), !!user?.isPhoneVerified, !!user?.dkCid, user?.referralCount ?? 0);
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  type TierProgress = { label: string; nextColor: string; progress: number; hint: string } | null;
  let tierProgress: TierProgress = null;
  if (tier === "rookie") {
    const left = Math.max(10 - total, 0);
    tierProgress = { label: "Rookie → Sharpshooter", nextColor: "#3b82f6", progress: Math.min(total / 10, 1), hint: left > 0 ? `${left} more picks to reach Sharpshooter` : "Almost there!" };
  } else if (tier === "sharpshooter") {
    const left = Math.max(50 - total, 0);
    tierProgress = { label: "Sharpshooter → Hot Hand", nextColor: "#10b981", progress: Math.min((Math.min(total / 50, 1) + Math.min(acc / 0.65, 1)) / 2, 1), hint: left > 0 ? `${left} more picks · aim for 65%+ accuracy` : acc < 0.65 ? `${Math.round((0.65 - acc) * 100)}% more accuracy needed` : "Keep it up!" };
  } else if (tier === "hot_hand") {
    const left = Math.max(100 - total, 0);
    tierProgress = { label: "Hot Hand → Legend", nextColor: "#f59e0b", progress: Math.min((Math.min(total / 100, 1) + Math.min(acc / 0.75, 1)) / 2, 1), hint: left > 0 ? `${left} more picks · aim for 75%+ accuracy` : acc < 0.75 ? `${Math.round((0.75 - acc) * 100)}% more accuracy needed` : "So close to Legend!" };
  }

  return (
    <Page>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes streakFire {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(239,68,68,0.5)); transform: scale(1); }
          50%       { filter: drop-shadow(0 0 8px rgba(249,115,22,0.8)); transform: scale(1.05); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 100px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Hero Card ────────────────────────────────────────── */}
        <div style={heroCard}>
          {/* Top row: avatar + name + settings */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt="avatar"
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: badgeColor ? `2.5px solid ${badgeColor}` : "2.5px solid rgba(255,255,255,0.4)",
                    boxShadow: badgeColor ? `0 0 12px ${badgeColor}66` : undefined,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: badgeColor ? `2.5px solid ${badgeColor}` : "2.5px solid rgba(255,255,255,0.3)" }}>
                  {(user?.firstName?.[0] || "?").toUpperCase()}
                </div>
              )}
              {/* Badge pip */}
              {badgeColor && (
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: badgeColor, border: "2px solid var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 6px ${badgeColor}66` }}>
                  <Medal size={11} color="#fff" />
                </div>
              )}
            </div>

            {/* Name + tier + streak */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                  {user?.firstName} {user?.lastName || ""}
                </span>
                {(user?.betStreakCount ?? 0) > 0 && (
                  <button
                    onClick={() => setStreakModalOpen(true)}
                    style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", border: "none", borderRadius: 12, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", animation: "streakFire 2s ease-in-out infinite", boxShadow: "0 4px 12px rgba(239,68,68,0.25)" }}
                  >
                    <Flame size={14} color="#fff" fill="#fff" />
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{user?.betStreakCount}</span>
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: tierBg, color: tierColor, border: `1px solid ${tierBorder}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {tierIcon}{tierLabel}
                </span>
              </div>
              {(user?.referralCount ?? 0) > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: 5 }}>
                  <UserPlus size={12} color="#6ee7b7" />
                  <span style={{ color: "#6ee7b7" }}>{user?.referralCount} friend{user?.referralCount !== 1 ? "s" : ""}</span> brought in
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => navigate("/settings")}
              aria-label="Settings"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", cursor: "pointer", flexShrink: 0, alignSelf: "flex-start", marginTop: 5 }}
            >
              <Settings size={16} />
            </button>
          </div>

          {/* Prediction stats row */}
          <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 14 }}>
            {[
              { label: "Win Rate", value: `${winRate}%`, color: winRate >= 60 ? "#6ee7b7" : winRate >= 40 ? "#fbbf24" : "#fca5a5", icon: <Target size={12} /> },
              { label: "Predictions", value: String(user?.totalPredictions ?? 0), color: "rgba(255,255,255,0.9)", icon: <TrendingUp size={12} /> },
              { label: "Insight Score", value: `${repScore}`, color: tierColor, icon: tierIcon },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.12)" : "none", paddingLeft: i > 0 ? 14 : 0 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.icon}{s.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Streak Status ─────────────────────────────────────── */}
        {(user?.betStreakCount ?? 0) > 0 && (
          <button
            onClick={() => setStreakModalOpen(true)}
            style={{ margin: "0 16px", borderRadius: 14, padding: "14px 16px", background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08))", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #ef4444, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "streakFire 2s ease-in-out infinite" }}>
              <Flame size={20} color="#fff" fill="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main)" }}>
                {user?.betStreakCount}-day prediction streak
              </div>
              <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>
                {(user?.betStreakCount ?? 0) >= 7
                  ? "1.2x payout boost is active on your next win!"
                  : `${7 - (user?.betStreakCount ?? 0)} more day${7 - (user?.betStreakCount ?? 0) !== 1 ? "s" : ""} until your 1.2x boost`}
              </div>
            </div>
            {/* Streak pip bar */}
            <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ width: 6, height: 18, borderRadius: 3, background: i < (user?.betStreakCount ?? 0) ? "linear-gradient(180deg, #f97316, #ef4444)" : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
          </button>
        )}

        {/* ── Tier Progress ─────────────────────────────────────── */}
        {tier === "legend" ? (
          <div style={{ margin: "0 16px", padding: "10px 14px", background: "rgba(245,158,11,0.1)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={14} color="#f59e0b" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>You've reached the top — Legend tier!</span>
          </div>
        ) : tierProgress ? (
          <div style={{ margin: "0 16px", padding: "12px 14px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--glass-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{tierProgress.label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: tierProgress.nextColor }}>{Math.round(tierProgress.progress * 100)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--bg-secondary)", overflow: "hidden", marginBottom: 7 }}>
              <div style={{ height: "100%", width: `${Math.round(tierProgress.progress * 100)}%`, borderRadius: 99, background: `linear-gradient(90deg, ${tierProgress.nextColor}99, ${tierProgress.nextColor})`, transition: "width 0.6s ease" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-subtle)", fontWeight: 600 }}>{tierProgress.hint}</span>
          </div>
        ) : null}

        {/* ── Collectibles row (tappable) ───────────────────────── */}
        <button
          onClick={() => setCollectiblesOpen(true)}
          style={{ margin: "0 16px", borderRadius: 14, padding: "14px 16px", background: "var(--bg-card)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Medal size={20} color="#f59e0b" />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Collectibles</div>
            <div style={{ fontSize: 11, color: unlockedCount > 0 ? "#f59e0b" : "var(--text-subtle)", marginTop: 2, fontWeight: 600 }}>
              {unlockedCount}/{badges.length} unlocked
            </div>
          </div>
          <ChevronRight size={16} color="var(--text-muted)" />
        </button>

        {/* ── Wallet shortcut ───────────────────────────────────── */}
        <button
          onClick={() => navigate("/wallet")}
          style={{ margin: "0 16px", borderRadius: 14, padding: "14px 16px", background: "var(--bg-card)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(39,117,208,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Wallet size={20} color="#2775d0" />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>Wallet & Transactions</div>
            <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 2 }}>Top up, cash out, transaction history</div>
          </div>
          <ChevronRight size={16} color="var(--text-muted)" />
        </button>

        {/* ── Invite & Referral ─────────────────────────────────── */}
        <div style={{ padding: "0 16px" }}>
          <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 16, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <UserPlus size={18} color="#818cf8" />
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}>Invite Friends</span>
              {(referralStats?.convertedCount ?? 0) > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "2px 8px", borderRadius: 99 }}>
                  {referralStats!.convertedCount} converted
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
              Earn <b style={{ color: "var(--text-main)" }}>Nu {referralStats?.flatBonus ?? 50} + {referralStats?.betPct ?? 5}%</b> of their first bet when they sign up with your link.
            </p>
            {referralStats?.totalEarned ? (
              <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, marginBottom: 10 }}>
                Total earned: Nu {Number(referralStats.totalEarned).toLocaleString()}
              </div>
            ) : null}
            <button
              onClick={() => setShowProfileShare(true)}
              style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 0", borderRadius: 12, background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.18))", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
            >
              <Share2 size={14} />
              Share your stats &amp; invite friends
            </button>
          </div>
        </div>
      </div>

      {/* ── Streak Benefits Modal ─────────────────────────────── */}
      <StreakBenefitsModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streakCount={user?.betStreakCount ?? 0}
      />

      {/* ── Collectibles Modal ────────────────────────────────── */}
      {collectiblesOpen && (
        <div
          onClick={() => setCollectiblesOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -4px 40px rgba(0,0,0,0.3)", animation: "fadeSlideUp 0.25s ease" }}
          >
            {/* Handle + header */}
            <div style={{ padding: "12px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--glass-border)" }} />
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)" }}>Collectibles</span>
                <button onClick={() => setCollectiblesOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: "16px 20px 40px", overflow: "visible" }}>
              <BadgeGrid
                totalPredictions={total}
                correctPredictions={correct}
                reputationTier={tier}
                reputationScore={Number(user?.reputationScore ?? 0)}
                hasPhone={!!user?.isPhoneVerified}
                hasDKBank={!!user?.dkCid}
                referralCount={user?.referralCount ?? 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Share Profile Modal ────────────────────────────────── */}
      {showProfileShare && (
        <div
          onClick={() => setShowProfileShare(false)}
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 520, position: "relative", animation: "fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            <button
              onClick={() => setShowProfileShare(false)}
              style={{ position: "absolute", top: -40, right: 0, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.8)", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
            <div style={{ marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Share Your Profile</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Challenge friends with your prediction record</div>
            </div>
            <ProfileShareCard
              userName={user?.username ? `@${user.username}` : (user?.firstName ?? "Predictor")}
              userPhotoUrl={user?.photoUrl ?? null}
              reputationTier={user?.reputationTier ?? "rookie"}
              reputationScore={Number(user?.reputationScore ?? 0)}
              totalPredictions={user?.totalPredictions ?? 0}
              correctPredictions={user?.correctPredictions ?? 0}
              referralId={String(user?.telegramId ?? user?.id ?? "")}
            />
          </div>
        </div>
      )}
    </Page>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const spinner: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "4px solid #e5e7eb",
  borderTop: "4px solid #2775d0",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const heroCard: React.CSSProperties = {
  background: "var(--balance-card-bg)",
  borderRadius: "0 0 28px 28px",
  padding: "16px 20px 24px",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "var(--balance-card-shadow)",
};
