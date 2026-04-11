import { FC, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dkBankLogo from "../../../assets/dk blue.png";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  linkDKBank,
  getMe,
  getMyTransactions,
  AuthUser,
  Transaction,
} from "@/api/client";
import {
  initiateDKBankDeposit,
  confirmDKBankDeposit,
  initiateDKBankWithdrawal,
  confirmDKBankWithdrawal,
  formatBTN,
} from "@/api/dkbank";
import { Page } from "@/tma/components/Page";
import { StreakBenefitsModal } from "@/tma/components/StreakBenefitsModal";
import { BetShareCard } from "@/tma/components/BetShareCard";
import { ProfileShareCard } from "@/tma/components/ProfileShareCard";
import {
  CheckCircle2,
  XCircle,
  Link2,
  Smartphone,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Target,
  Trophy,
  RotateCcw,
  Lock,
  Unlock,
  Wallet,
  Plus,
  ArrowUpCircle,
  Clock,
  X,
  Send,
  Share2,
  Flame,
  Eye,
  EyeOff,
  Sprout,
  Swords,
  Settings,
} from "lucide-react";

const AnimatedCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number;
    const duration = 1000;
    const startValue = displayValue;

    if (value === startValue) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(startValue + (value - startValue) * easeProgress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <>{Math.round(displayValue).toLocaleString()}</>;
};
type PaymentModalType = "deposit" | "withdraw" | null;
type PaymentStep = "amount" | "otp" | "success" | "failed";

const QUICK_DEPOSIT_AMOUNTS = [100, 200, 500, 1000];
const QUICK_WITHDRAW_AMOUNTS = [100, 200, 500, 1000];
const MIN_DEPOSIT = 50;
const MIN_WITHDRAW = 50;

// Color by amount direction: green = money in, red = money out
const TX_COLOR_IN = "#22c55e";
const TX_COLOR_OUT = "#ef4444";

const TX_ICON: Record<Transaction["type"], React.ReactNode> = {
  deposit: <ArrowDownLeft size={18} />,
  withdrawal: <ArrowUpRight size={18} />,
  bet_placed: <Target size={18} />,
  bet_payout: <Trophy size={18} />,
  refund: <RotateCcw size={18} />,
  dispute_bond: <Lock size={18} />,
  dispute_refund: <Unlock size={18} />,
};

// Human-readable labels — no developer language
const TX_LABEL: Record<Transaction["type"], string> = {
  deposit: "Top Up",
  withdrawal: "Cash Out",
  bet_placed: "Bet placed",
  bet_payout: "Win — payout received",
  refund: "Bet refunded",
  dispute_bond: "Dispute bond",
  dispute_refund: "Dispute bond refunded",
};

function TxRow({
  tx,
  onShareWin,
}: {
  tx: Transaction;
  onShareWin?: (tx: Transaction) => void;
}) {
  const isCredit = tx.amount > 0;
  const color = isCredit ? TX_COLOR_IN : TX_COLOR_OUT;
  const isWin = tx.type === "bet_payout";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 16px",
        borderBottom: "1px solid var(--glass-border)",
        background: isWin ? "rgba(34,197,94,0.04)" : "transparent",
      }}
    >
      {/* Icon bubble */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: `${color}18`,
          color,
        }}
      >
        {TX_ICON[tx.type]}
      </div>

      {/* Label + note + date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-main)",
            marginBottom: tx.note ? 2 : 0,
          }}
        >
          {tx.note ? tx.note : TX_LABEL[tx.type]}
        </div>
        {tx.note && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-subtle)",
              marginBottom: 2,
            }}
          >
            {TX_LABEL[tx.type]}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
          {new Date(tx.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Amount + share */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color }}>
          {isCredit ? "+" : "−"}
          {Math.abs(Number(tx.amount)).toLocaleString()}
        </div>
        <div
          style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 2 }}
        >
          Bal {Number(tx.balanceAfter).toLocaleString()}
        </div>
        {isWin && onShareWin && (
          <button
            onClick={() => onShareWin(tx)}
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 20,
              border: "1px solid rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.1)",
              color: "#22c55e",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Share2 size={10} /> Share win
          </button>
        )}
      </div>
    </div>
  );
}

export const TmaProfilePage: FC = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [freshUser, setFreshUser] = useState<AuthUser | null>(null);
  const [freshLoading, setFreshLoading] = useState(true);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));
  }, []);

  // Re-fetch balance whenever a bet or deposit fires from any page
  useEffect(() => {
    const handler = () => refreshWallet();
    window.addEventListener("oro:balance-changed", handler);
    return () => window.removeEventListener("oro:balance-changed", handler);
  }, []);

  const refreshWallet = () => {
    setBalanceLoading(true);
    getMe()
      .then((updated) => {
        const newBal = Number(updated.creditsBalance ?? 0);
        if (prevBalance.current > 0 && newBal > prevBalance.current) {
          setBalanceFlash(true);
          setTimeout(() => setBalanceFlash(false), 1400);
        }
        prevBalance.current = newBal;
        setFreshUser(updated);
      })
      .catch(() => {})
      .finally(() => setBalanceLoading(false));
    setTxLoading(true);
    setTxError(null);
    getMyTransactions()
      .then(setTxs)
      .catch((e) => setTxError(e.message))
      .finally(() => setTxLoading(false));
  };

  useEffect(() => {
    refreshWallet();
  }, []);

  const user = freshUser ?? authUser;
  const loading = authLoading && freshLoading;

  const [showAllTxs, setShowAllTxs] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const prevBalance = useRef(0);
  const [shareWinTx, setShareWinTx] = useState<Transaction | null>(null);
  const [showProfileShare, setShowProfileShare] = useState(false);

  // ── Payment modal state ───────────────────────────────────────────────────
  const [paymentModal, setPaymentModal] = useState<PaymentModalType>(null);
  const [payStep, setPayStep] = useState<PaymentStep>("amount");
  const [payAmountStr, setPayAmountStr] = useState("200");
  const [payOtp, setPayOtp] = useState("");
  const [payPendingId, setPayPendingId] = useState("");
  const [payError, setPayError] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState("");

  const openPaymentModal = (type: PaymentModalType) => {
    setPaymentModal(type);
    setPayStep("amount");
    setPayAmountStr("200");
    setPayOtp("");
    setPayPendingId("");
    setPayError("");
    setPayProcessing(false);
    setPaySuccessMsg("");
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    if (payStep === "success") refreshWallet();
  };

  const handlePaymentInitiate = async () => {
    const amount = parseFloat(payAmountStr);
    const minAmt = paymentModal === "deposit" ? MIN_DEPOSIT : MIN_WITHDRAW;
    if (!Number.isFinite(amount) || amount < minAmt) {
      setPayError(
        `Minimum ${paymentModal === "deposit" ? "top-up" : "cash out"} is Nu ${minAmt}.`,
      );
      return;
    }
    setPayError("");
    setPayProcessing(true);
    try {
      let res;
      if (paymentModal === "deposit") {
        if (!user?.dkCid) {
          setPayError("Please link your DK Bank account first (Profile tab).");
          setPayProcessing(false);
          return;
        }
        res = await initiateDKBankDeposit({ amount, cid: user.dkCid });
      } else {
        res = await initiateDKBankWithdrawal({ amount });
      }
      setPayPendingId(res.paymentId);
      setPayStep("otp");
    } catch (err: any) {
      setPayError(err.message || "Something went wrong. Please try again.");
    } finally {
      setPayProcessing(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (payOtp.length < 4) {
      setPayError("Please enter the OTP sent to your Telegram bot.");
      return;
    }
    setPayError("");
    setPayProcessing(true);
    try {
      if (paymentModal === "deposit") {
        await confirmDKBankDeposit(payPendingId, payOtp);
      } else {
        await confirmDKBankWithdrawal(payPendingId, payOtp);
      }
      setPaySuccessMsg(
        paymentModal === "deposit"
          ? `Nu ${parseFloat(payAmountStr).toLocaleString()} topped up successfully!`
          : `Nu ${parseFloat(payAmountStr).toLocaleString()} cash out confirmed. Funds on their way to DK Bank.`,
      );
      setPayStep("success");
    } catch (err: any) {
      setPayError(err.message || "OTP confirmation failed. Please try again.");
      if (
        err.message?.toLowerCase().includes("expired") ||
        err.message?.toLowerCase().includes("initiate")
      ) {
        setPayStep("failed");
      }
    } finally {
      setPayProcessing(false);
    }
  };

  const hasDKBank = !!user?.dkCid;
  const hasPhoneVerified = !!user?.isPhoneVerified;

  const [cid, setCid] = useState("");
  const [step, setStep] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedName, setLinkedName] = useState("");

  const handleLink = async () => {
    if (cid.length !== 11) {
      setErrorMsg("CID must be exactly 11 digits.");
      setStep("error");
      return;
    }
    setStep("loading");
    setErrorMsg("");
    try {
      const res = await linkDKBank(cid);
      setLinkedName(res.user.dkAccountName || res.user.firstName || "");
      setStep("success");
      const updated = await getMe();
      setFreshUser(updated);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to link CID. Please try again.");
      setStep("error");
    }
  };

  if (loading) {
    return (
      <Page>
        <div style={styles.center}>
          <div style={styles.spinner} />
        </div>
      </Page>
    );
  }

  const totalWon = txs
    .filter((t) => t.type === "bet_payout")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDeposited = txs
    .filter((t) => t.type === "deposit")
    .reduce((s, t) => s + Number(t.amount), 0);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyProfit = txs
    .filter((tx) => new Date(tx.createdAt) >= oneWeekAgo)
    .reduce((acc, tx) => {
      if (tx.type === "bet_payout") return acc + Math.abs(Number(tx.amount));
      if (tx.type === "bet_placed") return acc - Math.abs(Number(tx.amount));
      return acc;
    }, 0);

  return (
    <Page>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        @keyframes streakFire {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(239,68,68,0.5)); transform: scale(1); }
          50%       { filter: drop-shadow(0 0 8px rgba(249,115,22,0.8)); transform: scale(1.05); }
        }
        @keyframes balanceWin {
          0%   { transform: scale(1);    color: #fff; }
          20%  { transform: scale(1.08); color: #4ade80; }
          60%  { transform: scale(1.04); color: #4ade80; }
          100% { transform: scale(1);    color: #fff; }
        }
      `}</style>
      <div style={styles.container}>
        {/* ── Hero: Avatar + Balance ────────────────────────── */}
        <div style={styles.heroCard}>
          {/* Avatar + name + settings */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 20,
            }}
          >
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="avatar" style={styles.heroAvatar} />
            ) : (
              <div style={styles.heroAvatarPlaceholder}>
                {(user?.firstName?.[0] || "?").toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>
                  {user?.firstName} {user?.lastName || ""}
                </span>
                {(user?.betStreakCount ?? 0) > 0 && (
                  <button
                    onClick={() => setStreakModalOpen(true)}
                    style={{
                      background: "linear-gradient(135deg, #ef4444, #f97316)",
                      border: "none",
                      borderRadius: 12,
                      padding: "0px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                      animation: "streakFire 2s ease-in-out infinite",
                      boxShadow: "0 4px 12px rgba(239,68,68,0.25)",
                    }}
                  >
                    <Flame size={14} color="#fff" fill="#fff" />
                    <span
                      style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}
                    >
                      {user?.betStreakCount}
                    </span>
                  </button>
                )}
              </div>
              {/* Status chips */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {(() => {
                  const tier = user?.reputationTier ?? "newcomer";
                  const label =
                    tier === "expert"
                      ? "Legend"
                      : tier === "reliable"
                        ? "Hot Hand"
                        : tier === "regular"
                          ? "Sharpshooter"
                          : "Rookie";
                  const bg =
                    tier === "expert"
                      ? "rgba(245,158,11,0.25)"
                      : tier === "reliable"
                        ? "rgba(16,185,129,0.25)"
                        : tier === "regular"
                          ? "rgba(59,130,246,0.25)"
                          : "rgba(255,255,255,0.12)";
                  const color =
                    tier === "expert"
                      ? "#fbbf24"
                      : tier === "reliable"
                        ? "#6ee7b7"
                        : tier === "regular"
                          ? "#93c5fd"
                          : "rgba(255,255,255,0.6)";
                  const border =
                    tier === "expert"
                      ? "rgba(245,158,11,0.4)"
                      : tier === "reliable"
                        ? "rgba(16,185,129,0.4)"
                        : tier === "regular"
                          ? "rgba(59,130,246,0.4)"
                          : "rgba(255,255,255,0.2)";
                  const tierIcon =
                    tier === "expert" ? (
                      <Trophy size={11} />
                    ) : tier === "reliable" ? (
                      <Flame size={11} />
                    ) : tier === "regular" ? (
                      <Swords size={11} />
                    ) : (
                      <Sprout size={11} />
                    );
                  return (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: bg,
                        color,
                        border: `1px solid ${border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {tierIcon}
                      {label}
                    </span>
                  );
                })()}
              </div>
              {/* Referral count */}
              {(user?.referralCount ?? 0) > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.75)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span style={{ fontSize: 13 }}>👥</span>
                  You've brought{" "}
                  <span style={{ color: "#6ee7b7" }}>
                    {user?.referralCount} friend
                    {user?.referralCount !== 1 ? "s" : ""}
                  </span>{" "}
                  · Earned{" "}
                  <span style={{ color: "#fbbf24" }}>
                    {Math.min(50, (user?.referralCount ?? 0) * 2)}% bonus
                  </span>
                </div>
              )}
            </div>

            {/* Share + Settings — aligned to top of the row */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                alignSelf: "flex-start",
                flexShrink: 0,
                marginTop: 28,
              }}
            >
              <button
                onClick={() => setShowProfileShare(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#fff",
                  color: "#1e3a5f",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                }}
              >
                <Share2 size={13} />
                Share
              </button>
              <button
                onClick={() => navigate("/settings")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.5)",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <Settings size={13} />
                Settings
              </button>
            </div>
          </div>

          {/* Balance */}
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Available Balance
              <button
                onClick={() => setBalanceHidden((h) => !h)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.55)",
                  display: "flex",
                  alignItems: "center",
                  lineHeight: 1,
                }}
                aria-label={balanceHidden ? "Show balance" : "Hide balance"}
              >
                {balanceHidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                opacity: balanceLoading ? 0.5 : 1,
                transition: "opacity 0.3s",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                BTN
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: "-1px",
                  filter: balanceHidden ? "blur(10px)" : "none",
                  userSelect: balanceHidden ? "none" : "auto",
                  transition: "filter 0.2s ease",
                  textShadow: balanceFlash
                    ? "0 0 24px rgba(34,197,94,0.9)"
                    : "none",
                  animation: balanceFlash ? "balanceWin 1.4s ease-out" : "none",
                }}
              >
                <AnimatedCounter
                  value={Number(
                    freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
                  )}
                />
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderTop: "1px solid rgba(255,255,255,0.15)",
              paddingTop: 14,
              marginTop: 8,
            }}
          >
            {[
              {
                label: "Total Won",
                value: `+${totalWon.toLocaleString()}`,
                color: "#6ee7b7",
              },
              {
                label: "Deposited",
                value: `+${totalDeposited.toLocaleString()}`,
                color: "rgba(255,255,255,0.7)",
              },
              {
                label: "This Week",
                value: `${weeklyProfit >= 0 ? "+" : ""}${weeklyProfit.toLocaleString()}`,
                color: weeklyProfit >= 0 ? "#6ee7b7" : "#fca5a5",
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderLeft:
                    i > 0 ? "1px solid rgba(255,255,255,0.12)" : "none",
                  paddingLeft: i > 0 ? 14 : 0,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 600,
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────── */}
        <div style={styles.actionsRow}>
          <button
            style={styles.actionBtnPrimary}
            onClick={() => openPaymentModal("deposit")}
          >
            <Plus size={16} />
            Top Up
          </button>
          <button
            style={styles.actionBtnSecondary}
            onClick={() => openPaymentModal("withdraw")}
          >
            <ArrowUpCircle size={16} />
            Cash Out
          </button>
        </div>

        {/* ── DK Bank ── only show if not fully linked, or phone not yet verified */}
        {(!hasDKBank || !hasPhoneVerified) && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              <span style={styles.titleRow}>
                {hasDKBank ? (
                  <CheckCircle2 size={16} color="#059669" />
                ) : (
                  <Link2 size={16} color="#2775d0" />
                )}
                {hasDKBank ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        background: "#fff",
                        borderRadius: 4,
                        padding: "1px 5px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <img
                        src={dkBankLogo}
                        alt="DK Bank"
                        style={{ height: 14, width: "auto" }}
                      />
                    </span>
                    Linked
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Link
                    <img
                      src={dkBankLogo}
                      alt="DK Bank"
                      style={{
                        height: 14,
                        width: "auto",
                        mixBlendMode: "multiply",
                      }}
                    />
                    Account
                  </span>
                )}
              </span>
            </h3>
            {hasDKBank ? (
              <div style={styles.linkedInfo}>
                <p style={styles.linkedRow}>
                  <span style={styles.label}>CID</span>
                  <span style={styles.value}>{user?.dkCid}</span>
                </p>
                <p style={styles.linkedRow}>
                  <span style={styles.label}>Account</span>
                  <span style={styles.value}>{user?.dkAccountName || "—"}</span>
                </p>
                <p style={styles.linkedRow}>
                  <span style={styles.label}>Phone</span>
                  <span style={{ ...styles.value, ...styles.inlineIcon }}>
                    {user?.isDkPhoneLinked ? (
                      <>
                        <ShieldCheck size={13} color="#059669" /> Registered
                      </>
                    ) : (
                      <span style={{ color: "#d97706", ...styles.inlineIcon }}>
                        <AlertCircle size={13} color="#d97706" /> No phone on DK
                        Bank record
                      </span>
                    )}
                  </span>
                </p>
              </div>
            ) : (
              <>
                <p style={styles.hint}>
                  Enter your 11-digit Bhutanese National ID (CID) to link your
                  DK Bank account.
                </p>
                <input
                  style={styles.input}
                  type="tel"
                  inputMode="numeric"
                  placeholder="11-digit CID number"
                  maxLength={11}
                  value={cid}
                  onChange={(e) => {
                    setCid(e.target.value.replace(/\D/g, ""));
                    setStep("idle");
                    setErrorMsg("");
                  }}
                />
                {step === "error" && (
                  <p style={{ ...styles.error, ...styles.inlineIcon }}>
                    <XCircle size={14} color="#dc2626" />
                    {errorMsg}
                  </p>
                )}
                {step === "success" && (
                  <p style={{ ...styles.success, ...styles.inlineIcon }}>
                    <CheckCircle2 size={14} color="#059669" />
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <img
                        src={dkBankLogo}
                        alt="DK Bank"
                        style={{
                          height: 13,
                          width: "auto",
                          mixBlendMode: "multiply",
                        }}
                      />
                      account linked
                    </span>
                    {linkedName ? ` as ${linkedName}` : ""}!
                  </p>
                )}
                <button
                  style={{
                    ...styles.btn,
                    opacity: step === "loading" || cid.length !== 11 ? 0.6 : 1,
                  }}
                  disabled={step === "loading" || cid.length !== 11}
                  onClick={handleLink}
                >
                  <span style={styles.inlineIcon}>
                    {step === "loading" ? (
                      <>
                        <Loader2
                          size={15}
                          style={{ animation: "spin 0.8s linear infinite" }}
                        />{" "}
                        Linking…
                      </>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Link2 size={15} />
                        Link{" "}
                        <img
                          src={dkBankLogo}
                          alt="DK Bank"
                          style={{
                            height: 13,
                            width: "auto",
                            mixBlendMode: "multiply",
                          }}
                        />{" "}
                        Account
                      </span>
                    )}
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Phone Verification ── only show if phone not yet verified */}
        {!hasPhoneVerified && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              <span style={styles.titleRow}>
                {hasPhoneVerified ? (
                  <ShieldCheck size={16} color="#059669" />
                ) : (
                  <Smartphone size={16} color="#2775d0" />
                )}
                {hasPhoneVerified ? "Phone Verified" : "Verify Your Phone"}
              </span>
            </h3>
            {hasPhoneVerified ? (
              <p style={styles.hint}>
                Your Telegram phone matches your DK Bank registered phone.
                Payments are fully secured.
              </p>
            ) : (
              <>
                <p style={styles.hint}>
                  After linking your DK Bank CID above, go to the Oro bot and
                  send <strong>/verify</strong> to verify your phone number.
                </p>
                <div style={styles.steps}>
                  <Step
                    n={1}
                    done={hasDKBank}
                    text="Link DK Bank CID (above)"
                  />
                  <Step
                    n={2}
                    done={false}
                    text='Open Oro bot → send "/verify"'
                  />
                  <Step
                    n={3}
                    done={false}
                    text="Tap Share Phone Number in the bot"
                  />
                  <Step
                    n={4}
                    done={hasPhoneVerified}
                    text="Phone verified — payments unlocked!"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Transaction History ───────────────────────────── */}
        <div style={{ padding: "0 16px", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h2 style={walletStyles.sectionTitle}>Transaction History</h2>
              <div style={walletStyles.sectionSubtitle}>
                {txLoading
                  ? "Updating…"
                  : `${txs.length} transaction${txs.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            <Clock size={16} color="#9ca3af" />
          </div>
          {txLoading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "20px 0",
              }}
            >
              <div style={styles.spinner} />
            </div>
          )}
          {txError && !txLoading && (
            <div style={walletStyles.emptyState}>
              <AlertCircle size={48} color="#ef4444" />
              <p style={{ color: "#ef4444" }}>{txError}</p>
            </div>
          )}
          {!txLoading && !txError && (
            <>
              <div style={walletStyles.txList}>
                {txs.length === 0 ? (
                  <div style={walletStyles.emptyState}>
                    <Wallet size={48} color="#9ca3af" />
                    <p style={{ color: "#9ca3af" }}>No transactions yet</p>
                  </div>
                ) : (
                  txs
                    .slice(0, showAllTxs ? undefined : 5)
                    .map((tx) => (
                      <TxRow key={tx.id} tx={tx} onShareWin={setShareWinTx} />
                    ))
                )}
              </div>
              {txs.length > 5 && (
                <button
                  onClick={() => setShowAllTxs(!showAllTxs)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginTop: 12,
                    background: "var(--bg-card)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 12,
                    color: "var(--text-main)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Clock size={14} />
                  {showAllTxs ? "Show Less" : "View More History"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Payment Modal ───────────────────────────────────── */}
      {paymentModal && (
        <div
          style={modalStyles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePaymentModal();
          }}
        >
          <div style={modalStyles.sheet}>
            {/* Header */}
            <div style={modalStyles.header}>
              <div style={modalStyles.headerLeft}>
                <span
                  style={{
                    ...modalStyles.title,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {paymentModal === "deposit" ? "Top Up via" : "Cash Out to"}
                  <span
                    style={{
                      background: "#fff",
                      borderRadius: 5,
                      padding: "2px 6px",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={dkBankLogo}
                      alt="DK Bank"
                      style={{ height: 14, width: "auto" }}
                    />
                  </span>
                </span>
              </div>
              <button style={modalStyles.closeBtn} onClick={closePaymentModal}>
                <X size={18} />
              </button>
            </div>

            {/* ── Step: Amount ── */}
            {payStep === "amount" && (
              <div style={modalStyles.body}>
                {paymentModal === "deposit" && !user?.dkCid && (
                  <div style={modalStyles.warningBox}>
                    <AlertCircle size={14} color="#d97706" />
                    <span>
                      Link your DK Bank account (Profile tab) before topping up.
                    </span>
                  </div>
                )}
                {paymentModal === "withdraw" && !user?.dkCid && (
                  <div style={modalStyles.warningBox}>
                    <AlertCircle size={14} color="#d97706" />
                    <span>You need a linked DK Bank account to cash out.</span>
                  </div>
                )}

                <p style={modalStyles.label}>
                  {paymentModal === "deposit"
                    ? "Top-up amount (BTN)"
                    : "Cash out amount (BTN)"}
                </p>
                <input
                  style={modalStyles.input}
                  type="number"
                  inputMode="numeric"
                  min={paymentModal === "deposit" ? MIN_DEPOSIT : MIN_WITHDRAW}
                  placeholder="Enter amount"
                  value={payAmountStr}
                  onChange={(e) => {
                    setPayAmountStr(e.target.value);
                    setPayError("");
                  }}
                />

                <div style={modalStyles.quickRow}>
                  {(paymentModal === "deposit"
                    ? QUICK_DEPOSIT_AMOUNTS
                    : QUICK_WITHDRAW_AMOUNTS
                  ).map((amt) => (
                    <button
                      key={amt}
                      style={{
                        ...modalStyles.quickBtn,
                        ...(payAmountStr === String(amt)
                          ? modalStyles.quickBtnActive
                          : {}),
                      }}
                      onClick={() => {
                        setPayAmountStr(String(amt));
                        setPayError("");
                      }}
                    >
                      {formatBTN(amt).replace("Nu. ", "Nu ")}
                    </button>
                  ))}
                </div>

                {paymentModal === "deposit" && user?.dkCid && (
                  <div style={modalStyles.infoRow}>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      DK Account
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {user.dkAccountName || user.dkCid}
                    </span>
                  </div>
                )}
                {paymentModal === "withdraw" && (
                  <div style={modalStyles.infoRow}>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      Available balance
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      Nu{" "}
                      {Number(
                        freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
                      ).toLocaleString()}
                    </span>
                  </div>
                )}

                {payError && (
                  <div style={modalStyles.errorBox}>
                    <XCircle size={14} color="#dc2626" />
                    <span>{payError}</span>
                  </div>
                )}

                <button
                  style={{
                    ...modalStyles.primaryBtn,
                    opacity:
                      payProcessing ||
                      (paymentModal === "deposit" ? !user?.dkCid : !user?.dkCid)
                        ? 0.6
                        : 1,
                  }}
                  disabled={payProcessing}
                  onClick={handlePaymentInitiate}
                >
                  {payProcessing ? (
                    <>
                      <Loader2
                        size={16}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />{" "}
                      Sending OTP…
                    </>
                  ) : (
                    <>
                      <Send size={16} />{" "}
                      {paymentModal === "deposit"
                        ? "Deposit & Send OTP"
                        : "Withdraw & Send OTP"}
                    </>
                  )}
                </button>
                <p style={modalStyles.hint}>
                  An OTP will be sent to your Telegram bot to confirm this
                  transaction.
                </p>
              </div>
            )}

            {/* ── Step: OTP ── */}
            {payStep === "otp" && (
              <div style={modalStyles.body}>
                <div style={modalStyles.otpInfo}>
                  <Send size={32} color="#2775d0" />
                  <p
                    style={{
                      margin: "12px 0 4px",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "var(--text-main)",
                    }}
                  >
                    Check your Telegram
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    We sent a 6-digit OTP to confirm your{" "}
                    {paymentModal === "deposit"
                      ? `deposit of `
                      : `withdrawal of `}
                    <strong>
                      Nu {parseFloat(payAmountStr).toLocaleString()}
                    </strong>
                    .
                  </p>
                </div>

                <input
                  style={{
                    ...modalStyles.input,
                    textAlign: "center",
                    letterSpacing: 10,
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="● ● ● ● ● ●"
                  value={payOtp}
                  onChange={(e) => {
                    setPayOtp(e.target.value.replace(/\D/g, ""));
                    setPayError("");
                  }}
                  autoFocus
                />

                {payError && (
                  <div style={modalStyles.errorBox}>
                    <XCircle size={14} color="#dc2626" />
                    <span>{payError}</span>
                  </div>
                )}

                <button
                  style={{
                    ...modalStyles.primaryBtn,
                    opacity: payProcessing || payOtp.length < 4 ? 0.6 : 1,
                  }}
                  disabled={payProcessing || payOtp.length < 4}
                  onClick={handlePaymentConfirm}
                >
                  {payProcessing ? (
                    <>
                      <Loader2
                        size={16}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />{" "}
                      Confirming…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirm
                    </>
                  )}
                </button>
                <button
                  style={modalStyles.ghostBtn}
                  onClick={() => {
                    setPayStep("amount");
                    setPayOtp("");
                    setPayError("");
                  }}
                >
                  ← Change amount
                </button>
              </div>
            )}

            {/* ── Step: Success ── */}
            {payStep === "success" && (
              <div
                style={{
                  ...modalStyles.body,
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <CheckCircle2
                  size={56}
                  color="#059669"
                  style={{ marginBottom: 8 }}
                />
                <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>
                  {paymentModal === "deposit"
                    ? "Deposit Successful!"
                    : "Withdrawal Confirmed!"}
                </p>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    margin: "0 0 24px",
                    lineHeight: 1.6,
                  }}
                >
                  {paySuccessMsg}
                </p>
                <button
                  style={modalStyles.primaryBtn}
                  onClick={closePaymentModal}
                >
                  Done
                </button>
              </div>
            )}

            {/* ── Step: Failed ── */}
            {payStep === "failed" && (
              <div
                style={{
                  ...modalStyles.body,
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <XCircle
                  size={56}
                  color="#dc2626"
                  style={{ marginBottom: 8 }}
                />
                <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>
                  Transaction Failed
                </p>
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    margin: "0 0 24px",
                    lineHeight: 1.6,
                  }}
                >
                  {payError ||
                    "The transaction could not be completed. Please try again."}
                </p>
                <button
                  style={modalStyles.primaryBtn}
                  onClick={() => {
                    setPayStep("amount");
                    setPayError("");
                  }}
                >
                  Try Again
                </button>
                <button
                  style={modalStyles.ghostBtn}
                  onClick={closePaymentModal}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streak Benefits Modal */}
      <StreakBenefitsModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
        streakCount={user?.betStreakCount ?? 0}
      />

      {/* ── Share Win Modal ─────────────────────────────────── */}
      {shareWinTx && (
        <div
          onClick={() => setShareWinTx(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, position: "relative" }}
          >
            <button
              onClick={() => setShareWinTx(null)}
              style={{
                position: "absolute",
                top: -36,
                right: 0,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                padding: 6,
              }}
            >
              <X size={22} />
            </button>
            <BetShareCard
              userName={
                user?.username
                  ? `@${user.username}`
                  : (user?.firstName ?? "Predictor")
              }
              userPhotoUrl={user?.photoUrl ?? null}
              marketTitle={shareWinTx.note ?? "My prediction"}
              outcomePicked="Correct call!"
              stakeAmount={Number(shareWinTx.amount)}
              outcomeColor="#22c55e"
              referralId={String(user?.telegramId ?? user?.id ?? "")}
            />
          </div>
        </div>
      )}

      {/* ── Share Profile Modal ─────────────────────────────── */}
      {showProfileShare && (
        <div
          onClick={() => setShowProfileShare(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              position: "relative",
              animation:
                "fadeSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowProfileShare(false)}
              style={{
                position: "absolute",
                top: -40,
                right: 0,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>

            {/* Title */}
            <div style={{ marginBottom: 14, textAlign: "center" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                Share Your Profile
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Challenge friends with your prediction record
              </div>
            </div>

            <ProfileShareCard
              userName={
                user?.username
                  ? `@${user.username}`
                  : (user?.firstName ?? "Predictor")
              }
              userPhotoUrl={user?.photoUrl ?? null}
              reputationTier={user?.reputationTier ?? "newcomer"}
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

function Step({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <div style={styles.step}>
      <div
        style={{
          ...styles.stepNum,
          background: done ? "#2775d0" : "#e5e7eb",
          color: done ? "#fff" : "#6b7280",
        }}
      >
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
      <span style={{ ...styles.stepText, color: done ? "#111" : "#6b7280" }}>
        {text}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "0 0 100px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "50vh",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #2775d0",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  heroCard: {
    background: "var(--balance-card-bg)",
    borderRadius: "0 0 28px 28px",
    padding: "52px 20px 24px",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
    boxShadow: "var(--balance-card-shadow)",
  },
  heroAvatar: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2.5px solid rgba(255,255,255,0.4)",
    flexShrink: 0,
  },
  heroAvatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    fontSize: 22,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "2.5px solid rgba(255,255,255,0.3)",
  },
  actionsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    padding: "0 16px",
  },
  actionBtnPrimary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px",
    borderRadius: 12,
    border: "none",
    background: "var(--deposit-btn-bg)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  actionBtnSecondary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px",
    borderRadius: 12,
    border: "1.5px solid var(--glass-border)",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  card: {
    background: "var(--bg-card)",
    borderRadius: 16,
    padding: "18px 16px",
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    margin: "0 16px",
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text-main)",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  inlineIcon: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  hint: {
    margin: 0,
    fontSize: 14,
    color: "var(--text-muted)",
    lineHeight: 1.6,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: 16,
    borderRadius: 10,
    border: "1.5px solid var(--glass-border)",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    outline: "none",
    boxSizing: "border-box",
    letterSpacing: 2,
  },
  btn: {
    width: "100%",
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    background: "linear-gradient(135deg, #00499cff, #1a5bb5)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    transition: "opacity 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  error: {
    margin: 0,
    fontSize: 13,
    color: "#dc2626",
  },
  success: {
    margin: 0,
    fontSize: 13,
    color: "#059669",
    fontWeight: 600,
  },
  linkedInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  linkedRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    margin: 0,
    fontSize: 14,
  },
  label: {
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  value: {
    color: "var(--text-main)",
    fontWeight: 600,
    fontFamily: "monospace",
    fontSize: 13,
  },
  steps: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  stepText: {
    fontSize: 14,
    lineHeight: 1.4,
  },
};

const walletStyles: Record<string, React.CSSProperties> = {
  balanceCard: {
    background: "var(--balance-card-bg)",
    borderRadius: 20,
    padding: "28px 20px",
    color: "#ffffff",
    position: "relative",
    overflow: "hidden",
    boxShadow: "var(--balance-card-shadow)",
  },
  balanceLabel: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  balanceAmount: {
    fontSize: "2.4rem",
    fontWeight: 800,
    marginBottom: 20,
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },
  balanceCurrency: {
    fontSize: "1.1rem",
    fontWeight: 600,
    opacity: 0.9,
  },
  balanceStats: {
    display: "flex",
    gap: 28,
    borderTop: "1px solid rgba(255,255,255,0.2)",
    paddingTop: 16,
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
  },
  statLabel: {
    fontSize: "0.72rem",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 3,
  },
  statValue: {
    fontSize: "0.95rem",
    fontWeight: 700,
  },
  walletActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px",
    borderRadius: 12,
    border: "1.5px solid var(--glass-border)",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  actionBtnPrimary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px",
    borderRadius: 12,
    border: "none",
    background: "var(--deposit-btn-bg)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "var(--text-main)",
  },
  sectionSubtitle: {
    fontSize: "0.8rem",
    color: "var(--text-muted)",
    marginTop: 3,
    marginBottom: 0,
  },
  txList: {
    background: "var(--bg-card)",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
    border: "1px solid var(--glass-border)",
  },
  txRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderBottom: "1px solid var(--glass-border)",
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "var(--bg-main)",
    color: "var(--text-muted)",
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txLabel: {
    fontWeight: 600,
    fontSize: "0.9rem",
    color: "var(--text-main)",
    marginBottom: 2,
  },
  txNote: {
    fontSize: "0.75rem",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  txDate: {
    fontSize: "0.72rem",
    color: "var(--text-muted)",
    marginTop: 2,
  },
  txAmountCol: {
    textAlign: "right",
    flexShrink: 0,
  },
  txAmount: {
    fontWeight: 700,
    fontSize: "0.95rem",
  },
  txBalance: {
    fontSize: "0.72rem",
    color: "var(--text-muted)",
    marginTop: 2,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "40px 20px",
    color: "var(--text-muted)",
  },
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    background: "var(--bg-card)",
    borderRadius: "20px 20px 0 0",
    width: "100%",
    maxWidth: 480,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.25)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 16px 14px",
    borderBottom: "1px solid var(--glass-border)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontWeight: 700,
    fontSize: 16,
    color: "var(--text-main)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-muted)",
    padding: 4,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
  },
  body: {
    padding: "20px 16px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  label: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    padding: "14px",
    fontSize: 18,
    borderRadius: 12,
    border: "1.5px solid var(--glass-border)",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    outline: "none",
    boxSizing: "border-box" as const,
    fontWeight: 700,
  },
  quickRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
  },
  quickBtn: {
    padding: "10px 4px",
    borderRadius: 10,
    border: "1.5px solid var(--glass-border)",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  quickBtnActive: {
    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
    color: "#fff",
    border: "1.5px solid transparent",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "var(--bg-main)",
    borderRadius: 10,
    border: "1px solid var(--glass-border)",
  },
  warningBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "#fef3c7",
    borderRadius: 10,
    border: "1px solid #fcd34d",
    fontSize: 13,
    color: "#92400e",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "#fee2e2",
    borderRadius: 10,
    border: "1px solid #fca5a5",
    fontSize: 13,
    color: "#991b1b",
  },
  primaryBtn: {
    width: "100%",
    padding: "15px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "opacity 0.2s",
  },
  ghostBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 12,
    border: "1.5px solid var(--glass-border)",
    background: "transparent",
    color: "var(--text-muted)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "center" as const,
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    lineHeight: 1.5,
  },
  otpInfo: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "8px 0 4px",
  },
};
