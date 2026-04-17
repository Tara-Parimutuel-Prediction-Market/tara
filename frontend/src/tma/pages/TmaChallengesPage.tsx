import { FC, useState, useEffect, useCallback, type ReactNode } from "react";
import doubleDownImg from "../../assets/card/doubleDown.png";
import shieldImg from "../../assets/card/shield.png";
import ghostImg from "../../assets/card/ghost.png";
import { Page } from "@/tma/components/Page";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  getMarkets,
  getMyBets,
  getChallenges,
  getOpenChallenges,
  getDuelLeaderboard,
  createChallenge,
  joinChallenge,
  getMyCards,
  type Market,
  type Bet,
  type ChallengeResponse,
  type DuelLeaderboardEntry,
  type CardInventory,
  type CardType,
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
  Coins,
  Star,
  TrendingUp,
  Shield,
  EyeOff,
  Zap,
  Gift,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_PREDICTIONS_REQUIRED = 5;
const WAGER_PRESETS = [0, 50, 100, 500, 1000];

// ── Types ─────────────────────────────────────────────────────────────────────

type Challenge = ChallengeResponse;
type Tab = "mine" | "open" | "leaderboard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function statusColor(status: Challenge["status"]) {
  const map: Record<Challenge["status"], string> = {
    open: "#22c55e",
    active: "#f59e0b",
    settled: "#6366f1",
    expired: "#6b7280",
    void: "#6b7280",
  };
  return map[status] ?? "#6b7280";
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
        boxShadow: "6px 6px 16px rgba(0,0,0,0.3)",
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
          Make {MIN_PREDICTIONS_REQUIRED} predictions first to prove you're a
          real predictor — then challenge friends.
        </div>
      </div>
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

// ── Wager picker ──────────────────────────────────────────────────────────────

function WagerPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
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
        Stake (Oro credits)
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {WAGER_PRESETS.map((amt) => (
          <button
            key={amt}
            onClick={() => onChange(amt)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 10,
              background:
                value === amt ? "rgba(245,158,11,0.15)" : "var(--bg-main)",
              border: `1.5px solid ${value === amt ? "#f59e0b" : "var(--glass-border)"}`,
              color: value === amt ? "#f59e0b" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.7rem",
              cursor: "pointer",
            }}
          >
            {amt === 0 ? "Free" : `${amt}`}
          </button>
        ))}
      </div>
      {value > 0 && (
        <div
          style={{
            marginTop: 6,
            fontSize: "0.7rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Coins size={11} color="#f59e0b" />
          Winner takes{" "}
          <strong style={{ color: "#f59e0b" }}>
            Nu {(value * 2 * 0.9).toFixed(0)}
          </strong>{" "}
          — 10% platform fee
        </div>
      )}
    </div>
  );
}

// ── Card config ───────────────────────────────────────────────────────────────

const CARD_CONFIG: Record<
  CardType,
  {
    label: string;
    desc: string;
    color: string;
    bg: string;
    solidBg: string;
    border: string;
    glow: string;
    bg2: string;
    icon: ReactNode;
    img: string;
  }
> = {
  doubleDown: {
    label: "Double Down",
    desc: "Full 2× pot — no fee",
    color: "#f59e0b",
    bg: "#f59e0b14",
    solidBg: "#000000",
    border: "#f59e0b50",
    glow: "#f59e0b88",
    bg2: "#f59e0b25",
    icon: <Zap size={14} />,
    img: doubleDownImg,
  },
  shield: {
    label: "Shield",
    desc: "Streak safe on loss",
    color: "#3b82f6",
    bg: "#3b82f614",
    solidBg: "#010107",
    border: "#3b82f650",
    glow: "#3b82f688",
    bg2: "#3b82f625",
    icon: <Shield size={14} />,
    img: shieldImg,
  },
  ghost: {
    label: "Ghost",
    desc: "Stake hidden until accept",
    color: "#a78bfa",
    bg: "#a78bfa14",
    solidBg: "#a78bfa14",
    border: "#a78bfa50",
    glow: "#a78bfa88",
    bg2: "#a78bfa25",
    icon: <EyeOff size={14} />,
    img: ghostImg,
  },
};

// ── Card inventory strip

const CARD_MILESTONES_UI: Record<CardType, number> = {
  doubleDown: 3,
  shield: 7,
  ghost: 15,
};

function CardInventoryStrip({ inventory }: { inventory: CardInventory }) {
  return (
    <div
      style={{
        margin: "0 16px 14px",
        padding: "14px",
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.03))",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 800,
            color: "#818cf8",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Gift size={11} color="#818cf8" />
          Power Cards
        </div>
        <div
          style={{
            fontSize: "0.6rem",
            color: "var(--text-subtle)",
            fontWeight: 600,
          }}
        >
          Win duels to unlock
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {(["doubleDown", "shield", "ghost"] as CardType[]).map((key) => {
          const cfg = CARD_CONFIG[key];
          const count = inventory[key] ?? 0;
          const locked = count === 0;
          return (
            <div
              key={key}
              style={{
                flex: 1,
                padding: 0,
                borderRadius: 12,
                background: locked ? "var(--bg-main)" : cfg.solidBg,
                border: `1.5px solid ${locked ? "var(--glass-border)" : cfg.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* coloured glow at top when unlocked */}
              {!locked && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    background: `radial-gradient(ellipse at 50% 0%, ${cfg.color}30, transparent 70%)`,
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />
              )}
              {/* Card image fills the top of the cell edge-to-edge */}
              <div style={{ position: "relative", width: "100%", zIndex: 2 }}>
                <img
                  src={cfg.img}
                  alt={cfg.label}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    filter: locked
                      ? "grayscale(1) brightness(0.4)"
                      : `drop-shadow(0 2px 8px ${cfg.glow})`,
                    opacity: locked ? 0.5 : 1,
                    transition: "filter 0.2s, opacity 0.2s",
                  }}
                />
                {locked && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.3)",
                    }}
                  >
                    <Lock size={16} color="#94a3b8" />
                  </div>
                )}
              </div>
              {/* Label + badge below the image */}
              <div
                style={{
                  width: "100%",
                  padding: "6px 4px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  background: locked ? "transparent" : cfg.solidBg,
                }}
              >
                <div
                  style={{
                    fontSize: "0.58rem",
                    fontWeight: 700,
                    color: locked ? "var(--text-subtle)" : cfg.color,
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {cfg.label}
                </div>
                {locked ? (
                  <div
                    style={{
                      fontSize: "0.55rem",
                      color: "var(--text-subtle)",
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    {CARD_MILESTONES_UI[key]} wins
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 900,
                      color: "#fff",
                      background: cfg.bg2,
                      borderRadius: 6,
                      padding: "1px 6px",
                    }}
                  >
                    ×{count}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: "0.65rem",
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        {inventory.doubleDown + inventory.shield + inventory.ghost > 0
          ? "Equip a card when creating a duel for a special edge."
          : "Reach 3 duel wins to unlock your first card."}
      </div>
    </div>
  );
}

// ── Card picker ───────────────────────────────────────────────────────────────

function CardPicker({
  inventory,
  value,
  onChange,
}: {
  inventory: CardInventory;
  value: CardType | null;
  onChange: (v: CardType | null) => void;
}) {
  const hasAny = inventory.doubleDown + inventory.shield + inventory.ghost > 0;
  if (!hasAny) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Gift size={10} />
        Equip a card (optional)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(["doubleDown", "shield", "ghost"] as CardType[]).map((key) => {
          const cfg = CARD_CONFIG[key];
          const count = inventory[key] ?? 0;
          const locked = count === 0;
          const selected = value === key;
          return (
            <button
              key={key}
              onClick={() => !locked && onChange(selected ? null : key)}
              disabled={locked}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 10,
                background: selected ? cfg.solidBg : "var(--bg-main)",
                border: `1.5px solid ${selected ? cfg.color : locked ? "transparent" : "var(--glass-border)"}`,
                cursor: locked ? "not-allowed" : "pointer",
                textAlign: "left",
                opacity: locked ? 0.45 : 1,
                overflow: "hidden",
              }}
            >
              {/* Thumbnail: image fills its natural bg */}
              <div
                style={{
                  flexShrink: 0,
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: locked ? "#1a1a2e" : cfg.solidBg,
                  overflow: "hidden",
                  border: `1px solid ${locked ? "transparent" : cfg.border}`,
                  position: "relative",
                }}
              >
                <img
                  src={cfg.img}
                  alt={cfg.label}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    filter: locked
                      ? "grayscale(1) brightness(0.4)"
                      : selected
                        ? `drop-shadow(0 0 8px ${cfg.glow})`
                        : "none",
                  }}
                />
                {locked && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.4)",
                    }}
                  >
                    <Lock size={12} color="#94a3b8" />
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: selected
                      ? cfg.color
                      : locked
                        ? "var(--text-subtle)"
                        : "var(--text-main)",
                  }}
                >
                  {cfg.label}
                </div>
                <div
                  style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}
                >
                  {locked
                    ? `Unlock at ${CARD_MILESTONES_UI[key]} wins`
                    : cfg.desc}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: locked ? "var(--text-subtle)" : "var(--text-main)",
                  background: "var(--bg-card)",
                  padding: "2px 6px",
                  borderRadius: 6,
                }}
              >
                {locked ? "Locked" : `×${count}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Create challenge card ─────────────────────────────────────────────────────

function CreateChallengeCard({
  markets,
  userName,
  myBetMarketIds,
  cardInventory,
  onCreated,
}: {
  markets: Market[];
  userName: string;
  myBetMarketIds: Set<string>;
  cardInventory: CardInventory;
  onCreated?: (challenge: Challenge) => void;
}) {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("");
  const [wagerAmount, setWagerAmount] = useState(0);
  const [equippedCard, setEquippedCard] = useState<CardType | null>(null);
  const [created, setCreated] = useState(false);
  const [link, setLink] = useState("");
  const [createdChallenge, setCreatedChallenge] = useState<Challenge | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
        wagerAmount,
        equippedCard ?? undefined,
      );
      setLink(challenge.link);
      setCreatedChallenge(challenge);
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
    const wagerLine =
      wagerAmount > 0
        ? `\n\nStake: Nu ${wagerAmount} each — winner takes Nu ${(wagerAmount * 2 * 0.9).toFixed(0)}`
        : "";
    const text = `${userName} challenged you to a Prediction Duel!\n\nI bet on "${outcome?.label}" in:\n"${selectedMarket?.title}"${wagerLine}\n\nThink you can predict better? Beat me\n${link}`;
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
            marginBottom: 8,
          }}
        >
          <CheckCircle size={18} color="#22c55e" />
          <span
            style={{ fontWeight: 700, fontSize: "0.85rem", color: "#22c55e" }}
          >
            Duel Created
          </span>
        </div>
        {createdChallenge && Number(createdChallenge.wagerAmount) > 0 && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.25)",
              fontSize: "0.75rem",
              color: "#f59e0b",
              fontWeight: 700,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Coins size={12} />
            Nu {createdChallenge.wagerAmount} staked — winner takes Nu{" "}
            {createdChallenge.equippedCard === "doubleDown"
              ? (Number(createdChallenge.wagerAmount) * 2).toFixed(0)
              : (Number(createdChallenge.wagerAmount) * 2 * 0.9).toFixed(0)}
            {createdChallenge.equippedCard === "doubleDown" && (
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "#fbbf24",
                  fontWeight: 600,
                }}
              >
                (Double Down — no fee)
              </span>
            )}
          </div>
        )}
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          Share this with your opponent — they have 24h to accept.
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
            setWagerAmount(0);
            setEquippedCard(null);
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
          Create another duel
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
        boxShadow: "6px 6px 16px rgba(0,0,0,0.3)",
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
          New Duel
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
          Place a bet on an open market first, then come back to challenge
          someone on it.
        </div>
      ) : (
        <>
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
                Your prediction
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

          <WagerPicker value={wagerAmount} onChange={setWagerAmount} />

          <CardPicker
            inventory={cardInventory}
            value={equippedCard}
            onChange={setEquippedCard}
          />

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
              opacity: creating ? 0.7 : 1,
            }}
          >
            <Swords size={15} />
            {creating
              ? "Creating…"
              : wagerAmount > 0
                ? `Stake Nu ${wagerAmount} & Challenge`
                : "Challenge (Free)"}
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

// ── Challenge card (shared) ───────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  currentUserId,
  onJoin,
}: {
  challenge: Challenge;
  currentUserId?: string;
  onJoin?: (c: Challenge) => void;
}) {
  const [joining, setJoining] = useState(false);
  const [ghostConfirm, setGhostConfirm] = useState(false);
  const color = statusColor(challenge.status);
  const isGhost = challenge.wagerAmount === null; // Ghost card: wager hidden from non-owner
  const wager = isGhost ? 0 : Number(challenge.wagerAmount ?? 0);
  const isOwner = challenge.creatorId === currentUserId;

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const updated = await joinChallenge(challenge.id);
      onJoin?.(updated);
    } catch (err: any) {
      alert(err?.message ?? "Could not join duel");
    } finally {
      setJoining(false);
    }
  };

  const handleShare = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(challenge.link)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        boxShadow: "4px 4px 12px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-main)",
            lineHeight: 1.4,
            flex: 1,
            marginRight: 8,
          }}
        >
          {challenge.marketTitle}
        </div>
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            padding: "3px 7px",
            borderRadius: 6,
            background: `${color}18`,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          {challenge.status}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          marginBottom: wager > 0 ? 8 : 10,
        }}
      >
        <Flame size={11} color="#f59e0b" />
        <span style={{ fontWeight: 600, color: "#f59e0b" }}>
          {challenge.creatorName ?? "Someone"}
        </span>
        <span>·</span>
        <span>betting</span>
        <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
          {challenge.outcomeLabel}
        </span>
      </div>

      {(wager > 0 || isGhost) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: "0.72rem",
            color: isGhost ? "#a78bfa" : "#f59e0b",
            fontWeight: 700,
            marginBottom: 10,
            padding: "5px 10px",
            borderRadius: 8,
            background: isGhost
              ? "rgba(167,139,250,0.08)"
              : "rgba(245,158,11,0.08)",
            border: `1px solid ${isGhost ? "rgba(167,139,250,0.2)" : "rgba(245,158,11,0.2)"}`,
          }}
        >
          {isGhost ? <EyeOff size={11} /> : <Coins size={11} />}
          {isGhost
            ? "??? stake — hidden until you accept"
            : `Nu ${wager} stake — winner takes Nu ${challenge.equippedCard === "doubleDown" ? (wager * 2).toFixed(0) : (wager * 2 * 0.9).toFixed(0)}`}
          {challenge.equippedCard === "doubleDown" && (
            <span
              style={{ fontSize: "0.6rem", color: "#fbbf24", marginLeft: 2 }}
            >
              No fee
            </span>
          )}
        </div>
      )}

      {ghostConfirm && (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(167,139,250,0.1)",
            border: "1px solid rgba(167,139,250,0.3)",
            fontSize: "0.75rem",
            color: "#a78bfa",
            fontWeight: 600,
          }}
        >
          This duel has a hidden stake. You won't know the amount until after
          you accept. Continue?
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={() => {
                setGhostConfirm(false);
                handleJoin();
              }}
              style={{
                flex: 1,
                padding: "7px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                border: "none",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              Accept anyway
            </button>
            <button
              onClick={() => setGhostConfirm(false)}
              style={{
                flex: 1,
                padding: "7px",
                borderRadius: 8,
                background: "var(--bg-main)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
            <span>{challenge.participantCount} joined</span>
          </div>
          {challenge.status === "open" && (
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
              <span>{timeLeft(challenge.expiresAt)}</span>
            </div>
          )}
          {challenge.status === "settled" &&
            challenge.winnerId === currentUserId && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.7rem",
                  color: "#22c55e",
                  fontWeight: 700,
                }}
              >
                <Trophy size={11} />
                <span>You won!</span>
              </div>
            )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {challenge.status === "open" && !isOwner && !ghostConfirm && (
            <button
              onClick={() => (isGhost ? setGhostConfirm(true) : handleJoin())}
              disabled={joining}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: isGhost
                  ? "linear-gradient(135deg, #a78bfa, #7c3aed)"
                  : "linear-gradient(135deg, #f59e0b, #d97706)",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: joining ? "not-allowed" : "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#fff",
                opacity: joining ? 0.7 : 1,
              }}
            >
              {isGhost ? <EyeOff size={11} /> : <Swords size={11} />}
              {joining ? "…" : "Accept"}
            </button>
          )}
          {(challenge.status === "open" || challenge.status === "active") && (
            <button
              onClick={handleShare}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "1px solid var(--glass-border)",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              <Send size={11} />
              Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── My Duels tab ──────────────────────────────────────────────────────────────

function MyDuelsTab({
  markets,
  userName,
  myBetMarketIds,
  cardInventory,
  challenges,
  currentUserId,
  onChallengeCreated,
  onChallengeJoined,
}: {
  markets: Market[];
  userName: string;
  myBetMarketIds: Set<string>;
  cardInventory: CardInventory;
  challenges: Challenge[];
  currentUserId?: string;
  onChallengeCreated: (c: Challenge) => void;
  onChallengeJoined: (c: Challenge) => void;
}) {
  const [showAllDuels, setShowAllDuels] = useState(false);
  const DUEL_PREVIEW = 3;
  const visibleChallenges = showAllDuels
    ? challenges
    : challenges.slice(0, DUEL_PREVIEW);
  const hiddenCount = challenges.length - DUEL_PREVIEW;

  return (
    <>
      <CardInventoryStrip inventory={cardInventory} />
      <CreateChallengeCard
        markets={markets}
        userName={userName}
        myBetMarketIds={myBetMarketIds}
        cardInventory={cardInventory}
        onCreated={onChallengeCreated}
      />
      <div
        style={{
          padding: "4px 16px 10px",
          fontSize: "0.65rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Active Duels
      </div>
      {challenges.length === 0 ? (
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
          <Swords size={22} color="#f59e0b" />
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text-main)",
            }}
          >
            No active duels yet
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              lineHeight: 1.5,
              maxWidth: 240,
            }}
          >
            Create a duel above or accept one from the Open Feed.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            margin: "0 16px",
          }}
        >
          {visibleChallenges.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              currentUserId={currentUserId}
              onJoin={onChallengeJoined}
            />
          ))}
          {challenges.length > DUEL_PREVIEW && (
            <button
              onClick={() => setShowAllDuels((v) => !v)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 10,
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {showAllDuels ? (
                "▲ Show less"
              ) : (
                <>
                  <Swords size={13} />
                  View {hiddenCount} more duel{hiddenCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Open Feed tab ─────────────────────────────────────────────────────────────

function OpenFeedTab({
  challenges,
  currentUserId,
  loading,
  onJoin,
}: {
  challenges: Challenge[];
  currentUserId?: string;
  loading: boolean;
  onJoin: (c: Challenge) => void;
}) {
  if (loading) {
    return (
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
    );
  }

  if (challenges.length === 0) {
    return (
      <div
        style={{
          margin: "16px",
          padding: "32px 20px",
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
        <TrendingUp size={24} color="#6366f1" />
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-main)",
          }}
        >
          No open duels right now
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          Be the first — create a duel from the My Duels tab.
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
      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--text-muted)",
          marginBottom: 4,
          lineHeight: 1.4,
        }}
      >
        Open challenges from all users — accept any to compete for Oro.
      </div>
      {challenges.map((c) => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          currentUserId={currentUserId}
          onJoin={onJoin}
        />
      ))}
    </div>
  );
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────

function LeaderboardTab({
  entries,
  currentUserId,
  loading,
}: {
  entries: DuelLeaderboardEntry[];
  currentUserId?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
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
    );
  }

  if (entries.length === 0) {
    return (
      <div
        style={{
          margin: "16px",
          padding: "32px 20px",
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
        <Trophy size={24} color="#f59e0b" />
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "var(--text-main)",
          }}
        >
          No wins yet this week
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Settle a duel to appear on the board.
        </div>
      </div>
    );
  }

  const RANK_COLORS = ["#f59e0b", "#9ca3af", "#b45309"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "0 16px",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        This week's top predictors
      </div>
      {entries.map((e, i) => {
        const isMe = e.userId === currentUserId;
        return (
          <div
            key={e.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: isMe ? "rgba(99,102,241,0.08)" : "var(--bg-card)",
              border: `1px solid ${isMe ? "rgba(99,102,241,0.3)" : "var(--glass-border)"}`,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: i < 3 ? `${RANK_COLORS[i]}20` : "var(--bg-main)",
                border: `1.5px solid ${i < 3 ? RANK_COLORS[i] : "var(--glass-border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {i < 3 ? (
                <Star size={12} color={RANK_COLORS[i]} fill={RANK_COLORS[i]} />
              ) : (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    color: "var(--text-muted)",
                  }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: isMe ? "#818cf8" : "var(--text-main)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.username ? `@${e.username}` : "Anonymous"}
                {isMe ? " (you)" : ""}
              </div>
              {e.wagerWon > 0 && (
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: "#f59e0b",
                    fontWeight: 600,
                  }}
                >
                  Nu {e.wagerWon.toFixed(0)} won
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#22c55e",
              }}
            >
              <Trophy size={13} color="#22c55e" />
              {e.wins}W
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const TmaChallengesPage: FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [myBetMarketIds, setMyBetMarketIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [openChallenges, setOpenChallenges] = useState<Challenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<DuelLeaderboardEntry[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [totalBetCount, setTotalBetCount] = useState(0);
  const [cardInventory, setCardInventory] = useState<CardInventory>({
    doubleDown: 0,
    shield: 0,
    ghost: 0,
  });
  const [cardToast, setCardToast] = useState<string | null>(null);

  const isEligible = totalBetCount >= MIN_PREDICTIONS_REQUIRED;
  const currentUserId = user?.id;
  const userName = user?.username
    ? `@${user.username}`
    : (user?.firstName ?? "You");

  const CARDS_STORAGE_KEY = `oro_cards_${user?.id}`;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMarkets(),
      getMyBets(),
      getMyBets("pending"),
      getChallenges().catch(() => [] as Challenge[]),
      getMyCards().catch(
        () => ({ doubleDown: 0, shield: 0, ghost: 0 }) as CardInventory,
      ),
    ])
      .then(([allMarkets, allBets, pendingBets, mine, cards]) => {
        setMarkets(allMarkets.filter((m) => m.status === "open"));
        setTotalBetCount((allBets as Bet[]).length);
        setMyBetMarketIds(
          new Set((pendingBets as Bet[]).map((b) => b.marketId)),
        );
        setMyChallenges(mine as Challenge[]);
        setCardInventory(cards as CardInventory);

        // Toast if any card count increased since last visit
        const inv = cards as CardInventory;
        try {
          const prev = JSON.parse(
            localStorage.getItem(CARDS_STORAGE_KEY) ?? "{}",
          );
          const earned: string[] = [];
          (
            ["doubleDown", "shield", "ghost"] as (keyof CardInventory)[]
          ).forEach((k) => {
            if ((inv[k] ?? 0) > (prev[k] ?? 0))
              earned.push(CARD_CONFIG[k].label);
          });
          if (earned.length > 0)
            setCardToast(`New card unlocked: ${earned.join(", ")}!`);
          localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(inv));
        } catch {
          /* ignore */
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const loadOpen = useCallback(() => {
    if (openLoading) return;
    setOpenLoading(true);
    getOpenChallenges()
      .then(setOpenChallenges)
      .catch(console.error)
      .finally(() => setOpenLoading(false));
  }, [openLoading]);

  const loadLeaderboard = useCallback(() => {
    if (leaderboardLoading) return;
    setLeaderboardLoading(true);
    getDuelLeaderboard()
      .then(setLeaderboard)
      .catch(console.error)
      .finally(() => setLeaderboardLoading(false));
  }, [leaderboardLoading]);

  useEffect(() => {
    if (tab === "open") loadOpen();
    if (tab === "leaderboard" && leaderboard.length === 0) loadLeaderboard();
  }, [tab]);

  const handleChallengeCreated = (c: Challenge) =>
    setMyChallenges((prev) => [c, ...prev]);
  const handleChallengeJoined = (c: Challenge) => {
    setOpenChallenges((prev) => prev.filter((x) => x.id !== c.id));
    setMyChallenges((prev) => prev.map((x) => (x.id === c.id ? c : x)));
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "mine", label: "My Duels" },
    { key: "open", label: "Open Feed" },
    { key: "leaderboard", label: "Leaderboard" },
  ];

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
          padding: "9px 16px 0",
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
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))",
            border: "1px solid rgba(245,158,11,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 8,
          }}
        >
          <Swords size={20} color="#f59e0b" />
        </div>
        <div style={{ marginTop: -5 }}>
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
            Prediction Duels
          </h1>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              fontWeight: 600,
              marginTop: 3,
            }}
          >
            Stake Oro · Beat a friend · Win the pot
          </div>
        </div>
      </div>

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
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 4,
              margin: "14px 16px 14px",
              background: "var(--bg-main)",
              borderRadius: 10,
              padding: 4,
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 8,
                  background: tab === t.key ? "var(--bg-card)" : "transparent",
                  border: "none",
                  color:
                    tab === t.key ? "var(--text-main)" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "mine" && (
            <MyDuelsTab
              markets={markets}
              userName={userName}
              myBetMarketIds={myBetMarketIds}
              cardInventory={cardInventory}
              challenges={myChallenges}
              currentUserId={currentUserId}
              onChallengeCreated={handleChallengeCreated}
              onChallengeJoined={handleChallengeJoined}
            />
          )}
          {tab === "open" && (
            <OpenFeedTab
              challenges={openChallenges}
              currentUserId={currentUserId}
              loading={openLoading}
              onJoin={handleChallengeJoined}
            />
          )}
          {tab === "leaderboard" && (
            <LeaderboardTab
              entries={leaderboard}
              currentUserId={currentUserId}
              loading={leaderboardLoading}
            />
          )}

          <div style={{ height: 100 }} />
        </>
      )}

      {/* Card unlock toast */}
      {cardToast && (
        <div
          onClick={() => setCardToast(null)}
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 999,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            borderRadius: 14,
            padding: "12px 20px",
            boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 320,
            cursor: "pointer",
          }}
        >
          <Gift size={18} color="#fff" />
          <div>
            <div
              style={{ fontSize: "0.75rem", fontWeight: 800, color: "#fff" }}
            >
              {cardToast}
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.7)",
                marginTop: 2,
              }}
            >
              Equip it when creating your next duel
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};
