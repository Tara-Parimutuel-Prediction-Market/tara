import { FC, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Page } from "@/tma/components/Page";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  getMarkets,
  getMyBets,
  getChallenges,
  createChallenge,
  getReferralStats,
  type Market,
  type Bet,
  type ChallengeResponse,
  type ReferralStats,
} from "@/api/client";
import {
  Swords,
  Users,
  Lock,
  CheckCircle,
  Copy,
  Trophy,
  Flame,
  ChevronRight,
  Clock,
  Target,
  Send,
  Gift,
  Star,
  UserPlus,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_PREDICTIONS_REQUIRED = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

// Re-export the API shape locally for component props
type Challenge = ChallengeResponse;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

// ── Eligibility gate ──────────────────────────────────────────────────────────

function EligibilityGate({ totalPredictions }: { totalPredictions: number }) {
  const remaining = MIN_PREDICTIONS_REQUIRED - totalPredictions;
  const progress = Math.min(
    100,
    (totalPredictions / MIN_PREDICTIONS_REQUIRED) * 100,
  );

  return (
    <div
      style={{
        margin: "24px 16px",
        padding: "24px 20px",
        borderRadius: 20,
        background: "var(--bg-card)",
        boxShadow:
          "6px 6px 16px rgba(0,0,0,0.3), -3px -3px 10px rgba(255,255,255,0.03)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(99,102,241,0.12)",
          border: "2px solid rgba(99,102,241,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock size={28} color="#6366f1" />
      </div>

      <div>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 800,
            color: "var(--text-main)",
            marginBottom: 6,
          }}
        >
          Unlock Prediction Duels
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          Make {MIN_PREDICTIONS_REQUIRED} individual predictions first to prove
          you're a real predictor — then challenge friends.
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.7rem",
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--text-muted)",
          }}
        >
          <span>
            {totalPredictions} / {MIN_PREDICTIONS_REQUIRED} predictions
          </span>
          <span style={{ color: "#6366f1" }}>{remaining} to go</span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 99,
            background: "rgba(99,102,241,0.15)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 99,
              background: "linear-gradient(90deg, #6366f1, #818cf8)",
              transition: "width 0.6s ease",
            }}
          />
        </div>
      </div>

      <div
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          fontSize: "0.75rem",
          color: "#818cf8",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Target size={13} color="#818cf8" />
        Go to Feed and start predicting
      </div>
    </div>
  );
}

// ── Create challenge card ─────────────────────────────────────────────────────

function CreateChallengeCard({
  markets,
  userName,
  myBetMarketIds,
  preselectedMarketId,
  onCreated,
}: {
  markets: Market[];
  userName: string;
  myBetMarketIds: Set<string>;
  preselectedMarketId?: string;
  onCreated?: (challenge: Challenge) => void;
}) {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("");

  // Pre-select market from query param on first render
  useEffect(() => {
    if (preselectedMarketId && markets.length > 0 && !selectedMarket) {
      const m = markets.find((x) => x.id === preselectedMarketId);
      if (m) setSelectedMarket(m);
    }
  }, [preselectedMarketId, markets, selectedMarket]);
  const [created, setCreated] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Only show open markets where user has already bet
  const eligibleMarkets = markets.filter(
    (m) => m.status === "open" && myBetMarketIds.has(m.id),
  );

  const handleCreate = async () => {
    if (!selectedMarket || !selectedOutcomeId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const challenge = await createChallenge(
        selectedMarket.id,
        selectedOutcomeId,
      );
      setLink(challenge.link);
      setCreated(true);
      onCreated?.(challenge);
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create challenge");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const outcome = selectedMarket?.outcomes.find(
      (o) => o.id === selectedOutcomeId,
    );
    const text = `${userName} challenged you!\n\nI bet on "${outcome?.label}" in:\n"${selectedMarket?.title}"\n\nThink you can predict better? Beat me\n${link}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  if (created && link) {
    return (
      <div
        style={{
          margin: "0 16px 16px",
          padding: "20px",
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.04))",
          border: "1.5px solid rgba(34,197,94,0.3)",
          boxShadow: "6px 6px 16px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <CheckCircle size={18} color="#22c55e" />
          <span
            style={{ fontWeight: 700, fontSize: "0.85rem", color: "#22c55e" }}
          >
            Challenge Created
          </span>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          Share this link with friends — they have 24h to accept and bet.
        </div>
        <div
          style={{
            background: "var(--bg-main)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 11,
            color: "var(--text-subtle)",
            fontFamily: "monospace",
            wordBreak: "break-all",
            marginBottom: 12,
            border: "1px solid var(--glass-border)",
          }}
        >
          {link}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: copied ? "rgba(34,197,94,0.15)" : "var(--bg-main)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "var(--glass-border)"}`,
              color: copied ? "#22c55e" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleShare}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Send size={13} />
            Share via Telegram
          </button>
        </div>
        <button
          onClick={() => {
            setCreated(false);
            setSelectedMarket(null);
            setSelectedOutcomeId("");
          }}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "8px",
            background: "transparent",
            border: "1px solid var(--glass-border)",
            borderRadius: 10,
            fontSize: "0.75rem",
            color: "var(--text-subtle)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Create another challenge
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        margin: "0 16px 16px",
        padding: "20px",
        borderRadius: 18,
        background: "var(--bg-card)",
        boxShadow:
          "6px 6px 16px rgba(0,0,0,0.3), -3px -3px 10px rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Swords size={16} color="#f59e0b" />
        <span
          style={{
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "var(--text-main)",
          }}
        >
          New Challenge
        </span>
      </div>

      {eligibleMarkets.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "16px 0",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
          }}
        >
          You need to place a bet on an open market first,
          <br />
          then come back to challenge friends on it.
        </div>
      ) : (
        <>
          {/* Market picker */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Pick a market
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {eligibleMarkets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMarket(m);
                    setSelectedOutcomeId("");
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background:
                      selectedMarket?.id === m.id
                        ? "rgba(59,130,246,0.1)"
                        : "var(--bg-main)",
                    border: `1.5px solid ${selectedMarket?.id === m.id ? "#3b82f6" : "var(--glass-border)"}`,
                    color: "var(--text-main)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.title}
                  </span>
                  <ChevronRight
                    size={14}
                    color={
                      selectedMarket?.id === m.id
                        ? "#3b82f6"
                        : "var(--text-subtle)"
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Outcome picker */}
          {selectedMarket && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Your prediction to defend
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedMarket.outcomes.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOutcomeId(o.id)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background:
                        selectedOutcomeId === o.id
                          ? "rgba(245,158,11,0.12)"
                          : "var(--bg-main)",
                      border: `1.5px solid ${selectedOutcomeId === o.id ? "#f59e0b" : "var(--glass-border)"}`,
                      color:
                        selectedOutcomeId === o.id
                          ? "#f59e0b"
                          : "var(--text-main)",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!selectedMarket || !selectedOutcomeId || creating}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              background:
                selectedMarket && selectedOutcomeId
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : "var(--glass-border)",
              border: "none",
              color:
                selectedMarket && selectedOutcomeId
                  ? "#fff"
                  : "var(--text-subtle)",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor:
                selectedMarket && selectedOutcomeId && !creating
                  ? "pointer"
                  : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "opacity 0.2s",
              opacity: creating ? 0.7 : 1,
            }}
          >
            <Swords size={15} />
            {creating ? "Creating…" : "Create Challenge"}
          </button>
          {createError && (
            <div
              style={{
                marginTop: 8,
                fontSize: "0.75rem",
                color: "#f87171",
                textAlign: "center",
              }}
            >
              {createError}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Active challenges feed ────────────────────────────────────────────────────

function ActiveChallenges({ challenges }: { challenges: Challenge[] }) {
  if (challenges.length === 0) {
    return (
      <div
        style={{
          margin: "0 16px",
          padding: "28px 20px",
          borderRadius: 16,
          background: "var(--bg-card)",
          border: "1px solid var(--glass-border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Swords size={20} color="#f59e0b" />
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-main)",
          }}
        >
          No active challenges yet
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            lineHeight: 1.5,
            maxWidth: 240,
          }}
        >
          Create a challenge above and dare a friend to beat your prediction.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        margin: "0 16px",
      }}
    >
      {challenges.map((c) => (
        <div
          key={c.id}
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--glass-border)",
            boxShadow: "4px 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {/* Market title */}
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text-main)",
              marginBottom: 4,
              lineHeight: 1.4,
            }}
          >
            {c.marketTitle}
          </div>

          {/* Creator + outcome */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            <Flame size={11} color="#f59e0b" />
            <span style={{ fontWeight: 600, color: "#f59e0b" }}>
              {c.creatorName}
            </span>
            <span>·</span>
            <span>betting</span>
            <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
              {c.outcomeLabel}
            </span>
          </div>

          {/* Footer row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.7rem",
                  color: "var(--text-subtle)",
                  fontWeight: 500,
                }}
              >
                <Users size={11} />
                <span>{c.participantCount} joined</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.7rem",
                  color: "var(--text-subtle)",
                  fontWeight: 500,
                }}
              >
                <Clock size={10} />
                <span>{timeLeft(c.expiresAt)}</span>
              </div>
            </div>
            <button
              onClick={() => {
                const url = `https://t.me/share/url?url=${encodeURIComponent(c.link)}`;
                if (window.Telegram?.WebApp?.openTelegramLink) {
                  window.Telegram.WebApp.openTelegramLink(url);
                } else {
                  window.open(url, "_blank");
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "1px solid var(--glass-border)",
                borderRadius: 8,
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              <Send size={11} />
              Share
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Referral Prize Pool ───────────────────────────────────────────────────────

// Fallback constants — overridden by live values from API
const DEFAULT_REFERRAL_THRESHOLD = 10;
const DEFAULT_PRIZE_AMOUNT = 500;

function ReferralPrizePool({
  referralStats,
}: {
  referralStats: ReferralStats | null;
}) {
  const [copied, setCopied] = useState(false);
  const referred = referralStats?.referredCount ?? 0;
  const converted = referralStats?.convertedCount ?? 0;
  const threshold = referralStats?.prizeThreshold ?? DEFAULT_REFERRAL_THRESHOLD;
  const prizeAmount = referralStats?.prizeAmount ?? DEFAULT_PRIZE_AMOUNT;
  const prizeClaimed = referralStats?.prizeClaimed ?? false;
  const progress = Math.min(100, (converted / threshold) * 100);
  const remaining = Math.max(0, threshold - converted);
  const unlocked = converted >= threshold;

  const referralLink = referralStats?.referralLink ?? "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!referralLink) return;
    const text = `Join me on Tara — the prediction app for Bhutan 🇧🇹\n\nSign up and place your first bet to unlock real money prizes together!\n${referralLink}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div
      style={{
        margin: "16px 16px 0",
        borderRadius: 20,
        overflow: "hidden",
        border: unlocked
          ? "1.5px solid rgba(34,197,94,0.4)"
          : "1.5px solid rgba(245,158,11,0.3)",
        boxShadow: "6px 6px 18px rgba(0,0,0,0.28)",
      }}
    >
      {/* Header band */}
      <div
        style={{
          background: unlocked
            ? "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.06))"
            : "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: unlocked
              ? "rgba(34,197,94,0.15)"
              : "rgba(245,158,11,0.15)",
            border: `1px solid ${unlocked ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {unlocked ? (
            <Gift size={20} color="#22c55e" />
          ) : (
            <Star size={20} color="#f59e0b" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 800,
              color: "var(--text-main)",
              marginBottom: 1,
            }}
          >
            {unlocked ? "🎉 Prize Unlocked!" : `Nu ${prizeAmount} Prize Pool`}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            {unlocked
              ? "You've referred enough friends — prize is yours!"
              : `Refer ${threshold} friends who place a bet`}
          </div>
        </div>
        {unlocked && (
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              background: prizeClaimed
                ? "rgba(99,102,241,0.15)"
                : "rgba(34,197,94,0.15)",
              border: `1px solid ${prizeClaimed ? "rgba(99,102,241,0.35)" : "rgba(34,197,94,0.35)"}`,
              fontSize: "0.65rem",
              fontWeight: 800,
              color: prizeClaimed ? "#818cf8" : "#22c55e",
              letterSpacing: "0.04em",
            }}
          >
            {prizeClaimed ? "CLAIMED" : "UNLOCKED"}
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Stats row */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            {
              label: "Invited",
              value: referred,
              icon: <UserPlus size={12} color="#818cf8" />,
            },
            {
              label: "Joined & Bet",
              value: converted,
              icon: <CheckCircle size={12} color="#22c55e" />,
            },
            {
              label: "Goal",
              value: threshold,
              icon: <Trophy size={12} color="#f59e0b" />,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 12,
                background: "var(--bg-main)",
                border: "1px solid var(--glass-border)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 4,
                }}
              >
                {s.icon}
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: "0.62rem",
                  color: "var(--text-subtle)",
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {!unlocked && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.68rem",
                fontWeight: 700,
                marginBottom: 6,
                color: "var(--text-muted)",
              }}
            >
              <span>
                {converted} / {threshold} friends bet
              </span>
              <span style={{ color: "#f59e0b" }}>{remaining} to go</span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 99,
                background: "rgba(245,158,11,0.15)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  borderRadius: 99,
                  background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopy}
            disabled={!referralLink}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: copied ? "rgba(34,197,94,0.15)" : "var(--bg-main)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "var(--glass-border)"}`,
              color: copied ? "#22c55e" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.75rem",
              cursor: referralLink ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: referralLink ? 1 : 0.5,
            }}
          >
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleShare}
            disabled={!referralLink}
            style={{
              flex: 2,
              padding: "10px",
              borderRadius: 10,
              background: unlocked
                ? "linear-gradient(135deg, #22c55e, #16a34a)"
                : "linear-gradient(135deg, #f59e0b, #d97706)",
              border: "none",
              color: "#fff",
              fontWeight: 800,
              fontSize: "0.8rem",
              cursor: referralLink ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: referralLink ? 1 : 0.5,
            }}
          >
            <UserPlus size={14} />
            {unlocked ? "Invite More Friends" : "Invite Friends"}
          </button>
        </div>

        {/* Fine print */}
        <div
          style={{
            fontSize: "0.65rem",
            color: "var(--text-subtle)",
            textAlign: "center",
            lineHeight: 1.5,
            paddingTop: 2,
          }}
        >
          {prizeClaimed
            ? `Nu ${prizeAmount} has been credited to your DK Bank wallet. Keep inviting friends!`
            : `Friends must sign up via your link and place at least one bet to count. Prize of Nu ${prizeAmount} auto-credited to your DK Bank wallet.`}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const TmaChallengesPage: FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedMarketId = searchParams.get("marketId") ?? undefined;

  const [markets, setMarkets] = useState<Market[]>([]);
  const [myBetMarketIds, setMyBetMarketIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [totalBetCount, setTotalBetCount] = useState(0);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(
    null,
  );

  const isEligible = totalBetCount >= MIN_PREDICTIONS_REQUIRED;

  const userName = user?.username
    ? `@${user.username}`
    : (user?.firstName ?? "You");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMarkets(),
      getMyBets(),
      getMyBets("pending"),
      getChallenges().catch(() => [] as Challenge[]),
      getReferralStats().catch(() => null),
    ])
      .then(
        ([allMarkets, allBets, pendingBets, activeChallenges, refStats]) => {
          setMarkets(allMarkets.filter((m) => m.status === "open"));
          setTotalBetCount((allBets as Bet[]).length);
          setMyBetMarketIds(
            new Set((pendingBets as Bet[]).map((b) => b.marketId)),
          );
          setChallenges(activeChallenges as Challenge[]);
          setReferralStats(refStats as ReferralStats | null);
        },
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <Page>
      <style>{`
        @keyframes swordsShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-12deg); }
          75% { transform: rotate(12deg); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "9px 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            marginBottom: -10,
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))",
            border: "1px solid rgba(245,158,11,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Swords size={20} color="#f59e0b" />
        </div>
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "var(--text-main)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontFamily: "var(--font-display)",
              marginBottom: 0,
            }}
          >
            Duels
          </h1>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontWeight: 600,
              marginTop: 3,
            }}
          >
            Bet on what you like · Share · Challenge friends
          </div>
        </div>
      </div>

      {/* Eligibility gate or content */}
      {loading ? (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
          }}
        >
          Loading…
        </div>
      ) : !isEligible ? (
        <EligibilityGate totalPredictions={totalBetCount} />
      ) : (
        <>
          <div
            style={{
              margin: "0 16px 16px",
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(99,102,241,0.07)",
              border: "1px solid rgba(99,102,241,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "#818cf8",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 2,
              }}
            >
              How it works
            </div>
            {[
              {
                icon: <Target size={13} color="#818cf8" />,
                text: "Pick a market you've already bet on",
              },
              {
                icon: <Swords size={13} color="#818cf8" />,
                text: "Choose the outcome you're defending",
              },
              {
                icon: <Send size={13} color="#818cf8" />,
                text: "Share the duel link with a friend",
              },
              {
                icon: <Trophy size={13} color="#818cf8" />,
                text: "Whoever predicts better wins real DK Bank money",
              },
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: "rgba(99,102,241,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <span>{step.text}</span>
              </div>
            ))}
          </div>

          {/* Eligibility badge */}
          <div
            style={{
              margin: "0 16px 16px",
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#22c55e",
            }}
          >
            <Trophy size={13} />
            Eligible — {totalBetCount} bets placed
          </div>

          <CreateChallengeCard
            markets={markets}
            userName={userName}
            myBetMarketIds={myBetMarketIds}
            preselectedMarketId={preselectedMarketId}
            onCreated={(c) => setChallenges((prev) => [c, ...prev])}
          />

          {/* Active challenges */}
          <div
            style={{
              padding: "8px 16px 10px",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Active Challenges
          </div>
          <ActiveChallenges challenges={challenges} />

          {/* Referral Prize Pool */}
          <div
            style={{
              padding: "16px 16px 6px",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Prize Pool Challenge
          </div>
          <ReferralPrizePool referralStats={referralStats} />

          <div style={{ height: 100 }} />
        </>
      )}
    </Page>
  );
};
