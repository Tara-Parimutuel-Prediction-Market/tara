import { FC, useState, useEffect, useRef } from "react";
import dkBankLogo from "../../../assets/dk blue.png";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  linkDKBank,
  verifyPhoneTma,
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
import { BetShareCard } from "@/tma/components/BetShareCard";
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
  Eye,
  EyeOff,
  UserPlus,
  CalendarDays,
  Swords,
  Lightbulb,
  CheckCircle,
  Gift,
  Users,
} from "lucide-react";

// ── Shared types ──────────────────────────────────────────────────────────────
type PaymentModalType = "deposit" | "withdraw" | null;
type PaymentStep = "amount" | "otp" | "success" | "failed";

const QUICK_DEPOSIT_AMOUNTS = [100, 200, 500, 1000];
const QUICK_WITHDRAW_AMOUNTS = [100, 200, 500, 1000];
const MIN_DEPOSIT = 50;
const MAX_DEPOSIT = 15000;
const MIN_WITHDRAW = 50;

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
  referral_bonus: <UserPlus size={18} />,
  duel_wager: <Swords size={18} />,
  duel_payout: <Swords size={18} />,
};

const TX_LABEL: Record<Transaction["type"], string> = {
  deposit: "Top Up",
  withdrawal: "Cash Out",
  bet_placed: "Bet placed",
  bet_payout: "Win — payout received",
  refund: "Bet refunded",
  dispute_bond: "Dispute bond",
  dispute_refund: "Dispute bond refunded",
  referral_bonus: "Referral bonus",
  duel_wager: "Duel wager locked",
  duel_payout: "Duel payout",
};

// ── AnimatedCounter ────────────────────────────────────────────────────────────
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
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(startValue + (value - startValue) * ease);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value]);

  return <>{Math.round(displayValue).toLocaleString()}</>;
};

// ── TxRow ─────────────────────────────────────────────────────────────────────
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

// ── Step helper (phone verification) ─────────────────────────────────────────
function Step({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          background: done ? "var(--color-primary)" : "var(--bg-secondary)",
          color: done ? "#fff" : "var(--text-subtle)",
        }}
      >
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
      <span
        style={{
          fontSize: 14,
          lineHeight: 1.4,
          color: done ? "var(--text-main)" : "var(--text-muted)",
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const TmaWalletPage: FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();

  const [freshUser, setFreshUser] = useState<AuthUser | null>(null);
  const [freshLoading, setFreshLoading] = useState(true);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showAllTxs, setShowAllTxs] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const prevBalance = useRef(0);
  const [shareWinTx, setShareWinTx] = useState<Transaction | null>(null);
  const [showCoins, setShowCoins] = useState(false);

  // Deposit UX state
  const [isFirstDeposit, setIsFirstDeposit] = useState(false);
  const [depositStreakDays, setDepositStreakDays] = useState(0);
  const [referralDepositNudge, setReferralDepositNudge] = useState<{
    friendName: string;
    amount: number;
    bonusEarned: number;
  } | null>(null);
  const depositPrevBalance = useRef(0);

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<PaymentModalType>(null);
  const [payStep, setPayStep] = useState<PaymentStep>("amount");
  const [payAmountStr, setPayAmountStr] = useState("200");
  const [payOtp, setPayOtp] = useState("");
  const [payPendingId, setPayPendingId] = useState("");
  const [payError, setPayError] = useState("");
  const [payProcessing, setPayProcessing] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState("");

  // DK Bank link state
  const [cid, setCid] = useState("");
  const [linkStep, setLinkStep] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [linkError, setLinkError] = useState("");
  const [linkedName, setLinkedName] = useState("");

  // Phone verification state
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<
    "idle" | "waiting" | "success" | "error" | "unsupported"
  >("idle");
  const [phoneVerifyError, setPhoneVerifyError] = useState("");

  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));
  }, []);

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
      .then((txList) => {
        setTxs(txList);

        const depositTxs = txList.filter((t) => t.type === "deposit");
        setIsFirstDeposit(depositTxs.length === 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const depositDays = new Set(
          depositTxs.map((t) => {
            const d = new Date(t.createdAt);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          }),
        );
        let streak = 0;
        for (let i = 0; i < 365; i++) {
          const day = new Date(today.getTime() - i * 86_400_000);
          if (depositDays.has(day.getTime())) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }
        setDepositStreakDays(streak);

        const latestReferralBonus = txList.find(
          (t) => t.type === "referral_bonus",
        );
        if (latestReferralBonus) {
          setReferralDepositNudge({
            friendName:
              latestReferralBonus.note
                ?.replace("Referral bonus: ", "")
                .split(" ")[0] ?? "Your friend",
            amount: Math.abs(Number(latestReferralBonus.amount)) * 20,
            bonusEarned: Math.abs(Number(latestReferralBonus.amount)),
          });
        }
      })
      .catch((e) => setTxError(e.message))
      .finally(() => setTxLoading(false));
  };

  useEffect(() => {
    refreshWallet();
  }, []);

  const user = freshUser ?? authUser;
  const loading = authLoading && freshLoading;

  const hasDKBank = !!user?.dkCid;
  const hasPhoneVerified = !!user?.isPhoneVerified;

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

  // Payment modal handlers
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
    if (paymentModal === "deposit" && amount > MAX_DEPOSIT) {
      setPayError(`Maximum deposit is Nu ${MAX_DEPOSIT.toLocaleString()} per transaction.`);
      return;
    }
    setPayError("");
    setPayProcessing(true);
    if (paymentModal === "deposit") {
      depositPrevBalance.current = Number(
        freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
      );
    }
    try {
      let res;
      if (paymentModal === "deposit") {
        if (!user?.dkCid) {
          setPayError("Please link your DK Bank account first.");
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
      if (paymentModal === "deposit") {
        setShowCoins(true);
        setTimeout(() => setShowCoins(false), 3500);
      }
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

  const handleLink = async () => {
    if (cid.length !== 11) {
      setLinkError("CID must be exactly 11 digits.");
      setLinkStep("error");
      return;
    }
    setLinkStep("loading");
    setLinkError("");
    try {
      const res = await linkDKBank(cid);
      setLinkedName(res.user.dkAccountName || res.user.firstName || "");
      setLinkStep("success");
      const updated = await getMe();
      setFreshUser(updated);
    } catch (err: any) {
      setLinkError(err.message || "Failed to link CID. Please try again.");
      setLinkStep("error");
    }
  };

  const handleVerifyPhone = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.requestContact) {
      setPhoneVerifyStep("unsupported");
      return;
    }
    setPhoneVerifyStep("waiting");
    setPhoneVerifyError("");

    tg.onEvent("contactRequested", async (result: any) => {
      tg.offEvent("contactRequested");
      if (result?.status !== "sent" || !result?.contact?.phone_number) {
        setPhoneVerifyStep("idle");
        return;
      }
      try {
        await verifyPhoneTma({
          phoneNumber: result.contact.phone_number,
          userId: result.contact.user_id,
          authDate: result.auth_date,
          hash: result.hash,
        });
        setPhoneVerifyStep("success");
        const updated = await getMe();
        setFreshUser(updated);
      } catch (err: any) {
        setPhoneVerifyStep("error");
        setPhoneVerifyError(err.message || "Verification failed. Please try again.");
      }
    });

    tg.requestContact();
  };

  if (loading) {
    return (
      <Page>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <div style={spinner} />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes balanceWin {
          0%   { transform: scale(1);    color: #fff; }
          20%  { transform: scale(1.08); color: #4ade80; }
          60%  { transform: scale(1.04); color: #4ade80; }
          100% { transform: scale(1);    color: #fff; }
        }
        @keyframes coinFall {
          0%   { transform: translateY(-60px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes depositSuccessPop {
          0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          55%  { transform: scale(1.18) rotate(3deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes depositSuccessGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50%       { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
        }
        @keyframes otpDigitPop {
          0%   { transform: scale(0.7); opacity: 0.3; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes nudgePulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.015); }
        }
        @keyframes bonusBannerShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Desktop layout */
        @media (min-width: 640px) {
          .wallet-hero-card {
            border-radius: var(--radius-xl) !important;
            margin: 20px 0 0 !important;
          }
          .wallet-actions {
            padding: 0 !important;
          }
          .wallet-card-section {
            margin: 0 !important;
          }
          .wallet-tx-section {
            padding: 0 !important;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 0 100px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        {/* ── Balance Hero Card ─────────────────────────────── */}
        <div className="wallet-hero-card" style={balanceCard}>
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
              marginBottom: 20,
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

          {/* Financial stats row */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderTop: "1px solid rgba(255,255,255,0.15)",
              paddingTop: 14,
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-sm)",
            padding: "0 var(--space-md)",
          }}
        >
          <button
            style={actionBtnPrimary}
            onClick={() => openPaymentModal("deposit")}
          >
            <Plus size={16} /> Top Up
          </button>
          <button
            style={actionBtnSecondary}
            onClick={() => openPaymentModal("withdraw")}
          >
            <ArrowUpCircle size={16} /> Cash Out
          </button>
        </div>

        {/* ── First-Deposit Bonus Banner ─────────────────────── */}
        {isFirstDeposit && (
          <div
            style={{
              margin: "0 16px",
              borderRadius: 14,
              padding: "14px 16px",
              background:
                "linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #f59e0b 70%, #d97706 100%)",
              backgroundSize: "200% auto",
              animation:
                "bonusBannerShimmer 3s linear infinite, nudgePulse 2.5s ease-in-out infinite",
              boxShadow: "0 4px 16px rgba(245,158,11,0.35)",
              cursor: "pointer",
            }}
            onClick={() => openPaymentModal("deposit")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Gift size={26} color="#1c1917" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 900, color: "#1c1917" }}
                >
                  First Deposit Bonus — +10% Free!
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#451a03",
                    marginTop: 2,
                    fontWeight: 600,
                  }}
                >
                  Deposit Nu 500 → get Nu 550 to bet with. Limited time.
                </div>
              </div>
              <div
                style={{
                  background: "#1c1917",
                  color: "#fbbf24",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                Claim →
              </div>
            </div>
          </div>
        )}

        {/* ── Referral Deposit Nudge ─────────────────────────── */}
        {referralDepositNudge && (
          <div
            style={{
              margin: "0 16px",
              borderRadius: 14,
              padding: "12px 14px",
              background:
                "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))",
              border: "1px solid rgba(34,197,94,0.3)",
              animation: "nudgePulse 3s ease-in-out infinite",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Users size={22} color="#22c55e" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Your friend{" "}
                <span style={{ color: "#22c55e" }}>
                  {referralDepositNudge.friendName}
                </span>{" "}
                deposited Nu {referralDepositNudge.amount.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-subtle)",
                  marginTop: 2,
                }}
              >
                You earned{" "}
                <strong style={{ color: "#4ade80" }}>
                  Nu {referralDepositNudge.bonusEarned.toLocaleString()}
                </strong>{" "}
                instantly!
              </div>
            </div>
            <button
              onClick={() => setReferralDepositNudge(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-subtle)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Deposit Streak Progress ────────────────────────── */}
        {depositStreakDays > 0 && (
          <div
            style={{
              margin: "0 16px",
              borderRadius: 14,
              padding: "12px 14px",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.06))",
              border: "1px solid rgba(99,102,241,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <CalendarDays
              size={20}
              style={{ color: "#6366f1", flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Deposit Streak
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 5,
                }}
              >
                {Array.from({ length: Math.min(depositStreakDays, 7) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 8,
                        borderRadius: 4,
                        background:
                          i < depositStreakDays
                            ? "linear-gradient(90deg, #6366f1, #818cf8)"
                            : "var(--glass-border)",
                        transition: "background 0.3s",
                      }}
                    />
                  ),
                )}
                {depositStreakDays < 7 && (
                  <div
                    style={{
                      width: 22,
                      height: 8,
                      borderRadius: 4,
                      background: "var(--glass-border)",
                      opacity: 0.4,
                    }}
                  />
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#818cf8" }}>
                {depositStreakDays}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                day{depositStreakDays !== 1 ? "s" : ""}
              </div>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6366f1",
                fontWeight: 700,
                marginLeft: 2,
              }}
            >
              keep it going →
            </div>
          </div>
        )}

        {/* ── DK Bank ─────────────────────────────────────────── */}
        <div style={card}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text-main)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                  Account
                </span>
              )}
            </span>
          </h3>

          {hasDKBank ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "CID", value: user?.dkCid },
                { label: "Account", value: user?.dkAccountName || "—" },
              ].map(({ label, value }) => (
                <p
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    margin: 0,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                    {label}
                  </span>
                  <span
                    style={{
                      color: "var(--text-main)",
                      fontWeight: 600,
                      fontFamily: "monospace",
                      fontSize: 13,
                    }}
                  >
                    {value}
                  </span>
                </p>
              ))}
              <p
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  margin: 0,
                  fontSize: 14,
                }}
              >
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                  Phone
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    color: "var(--text-main)",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {user?.isDkPhoneLinked ? (
                    <>
                      <ShieldCheck size={13} color="#059669" /> Registered
                    </>
                  ) : (
                    <span
                      style={{
                        color: "#d97706",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <AlertCircle size={13} color="#d97706" /> No phone on DK
                      Bank record
                    </span>
                  )}
                </span>
              </p>
            </div>
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                Enter your 11-digit Bhutanese National ID (CID) to link your DK
                Bank account.
              </p>
              <input
                style={{
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
                }}
                type="tel"
                inputMode="numeric"
                placeholder="11-digit CID number"
                maxLength={11}
                value={cid}
                onChange={(e) => {
                  setCid(e.target.value.replace(/\D/g, ""));
                  setLinkStep("idle");
                  setLinkError("");
                }}
              />
              {linkStep === "error" && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <XCircle size={14} color="#dc2626" />
                  {linkError}
                </p>
              )}
              {linkStep === "success" && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#059669",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
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
                  width: "100%",
                  padding: "14px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--grad-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  opacity:
                    linkStep === "loading" || cid.length !== 11 ? 0.6 : 1,
                }}
                disabled={linkStep === "loading" || cid.length !== 11}
                onClick={handleLink}
              >
                {linkStep === "loading" ? (
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
                    <Link2 size={15} /> Link
                    <span
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <img
                        src={dkBankLogo}
                        alt="DK Bank"
                        style={{ height: 13, width: "auto" }}
                      />
                    </span>
                    Account
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* ── Phone Verification ───────────────────────────── */}
        {!hasPhoneVerified && (
          <div style={card}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-main)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Smartphone size={16} color="var(--color-primary)" />
                Verify Your Phone
              </span>
            </h3>

            {phoneVerifyStep === "success" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.25)",
                }}
              >
                <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>
                    Phone verified!
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    Your Telegram is now securely linked to DK Bank. Payments unlocked.
                  </div>
                </div>
              </div>
            ) : phoneVerifyStep === "unsupported" ? (
              <>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Your Telegram version doesn't support in-app phone sharing. Open the Oro bot and send <strong>/verify</strong> instead.
                </p>
                <Step n={1} done={hasDKBank} text="Link DK Bank CID (above)" />
                <Step n={2} done={false} text='Open Oro bot → send "/verify"' />
                <Step n={3} done={false} text="Tap Share Phone Number in the bot" />
              </>
            ) : (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Link your DK Bank CID above, then tap the button below to verify your phone. Telegram will confirm it matches your DK Bank account.
                </p>

                {phoneVerifyStep === "error" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.2)",
                      fontSize: 13,
                      color: "#dc2626",
                    }}
                  >
                    <XCircle size={14} color="#dc2626" style={{ flexShrink: 0 }} />
                    {phoneVerifyError}
                  </div>
                )}

                <button
                  style={{
                    width: "100%",
                    padding: "14px",
                    fontSize: 15,
                    fontWeight: 700,
                    background: hasDKBank
                      ? "linear-gradient(135deg, #00499cff, #1a5bb5)"
                      : "var(--glass-border)",
                    color: hasDKBank ? "#fff" : "var(--text-muted)",
                    border: "none",
                    borderRadius: 12,
                    cursor: hasDKBank ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: phoneVerifyStep === "waiting" ? 0.7 : 1,
                  }}
                  disabled={!hasDKBank || phoneVerifyStep === "waiting"}
                  onClick={handleVerifyPhone}
                >
                  {phoneVerifyStep === "waiting" ? (
                    <>
                      <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />
                      Waiting for Telegram…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={15} />
                      {phoneVerifyStep === "error" ? "Try Again" : "Verify Phone with Telegram"}
                    </>
                  )}
                </button>

                {!hasDKBank && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                    Link your DK Bank account first to enable phone verification.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Transaction History ───────────────────────────── */}
        <div className="wallet-tx-section" style={{ padding: "0 16px", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Transaction History
              </h2>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginTop: 3,
                }}
              >
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
              <div style={spinner} />
            </div>
          )}
          {txError && !txLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "40px 20px",
                color: "var(--text-muted)",
              }}
            >
              <AlertCircle size={48} color="#ef4444" />
              <p style={{ color: "#ef4444" }}>{txError}</p>
            </div>
          )}

          {!txLoading && !txError && (
            <>
              {(() => {
                const referralTxs = txs.filter(
                  (t) => t.type === "referral_bonus",
                );
                if (referralTxs.length === 0) return null;
                const totalEarned = referralTxs.reduce(
                  (s, t) => s + Number(t.amount),
                  0,
                );
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      marginBottom: 8,
                      borderRadius: 12,
                      background: "rgba(34,197,94,0.06)",
                      border: "1px solid rgba(34,197,94,0.18)",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "rgba(34,197,94,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Users size={16} color="#22c55e" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text-main)",
                        }}
                      >
                        Friends earned you a bonus
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-subtle)",
                          marginTop: 2,
                        }}
                      >
                        {referralTxs.length} friend
                        {referralTxs.length !== 1 ? "s" : ""} placed a bet ·
                        bonus credited to your wallet
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#22c55e",
                        }}
                      >
                        +{totalEarned.toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-subtle)",
                          marginTop: 1,
                        }}
                      >
                        BTN earned
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {txs.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      padding: "40px 20px",
                      color: "var(--text-muted)",
                    }}
                  >
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

      {/* ── Payment Modal ─────────────────────────────────────── */}
      {paymentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePaymentModal();
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 -4px 40px rgba(0,0,0,0.25)",
              paddingBottom: 70,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px 12px",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  color: "var(--text-main)",
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
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={closePaymentModal}
              >
                <X size={18} />
              </button>
            </div>

            {/* Step: Amount */}
            {payStep === "amount" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                }}
              >
                {paymentModal === "deposit" && !user?.dkCid && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(217,119,6,0.1)",
                      border: "1px solid rgba(217,119,6,0.3)",
                      fontSize: 13,
                      color: "#d97706",
                    }}
                  >
                    <AlertCircle size={14} color="#d97706" />
                    <span>Link your DK Bank account before topping up.</span>
                  </div>
                )}
                {paymentModal === "withdraw" && !user?.dkCid && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(217,119,6,0.1)",
                      border: "1px solid rgba(217,119,6,0.3)",
                      fontSize: 13,
                      color: "#d97706",
                    }}
                  >
                    <AlertCircle size={14} color="#d97706" />
                    <span>You need a linked DK Bank account to cash out.</span>
                  </div>
                )}
                {paymentModal === "deposit" && isFirstDeposit && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background:
                        "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.1))",
                      border: "1px solid rgba(245,158,11,0.4)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Gift size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#f59e0b",
                        }}
                      >
                        +10% First Deposit Bonus!
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        Deposit Nu 500 → you get{" "}
                        <strong style={{ color: "#fbbf24" }}>Nu 550</strong> to
                        bet with
                      </div>
                    </div>
                  </div>
                )}
                {paymentModal === "deposit" && !isFirstDeposit && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      fontSize: 12,
                      color: "#a5b4fc",
                      fontWeight: 600,
                    }}
                  >
                    <Lightbulb
                      size={13}
                      style={{
                        verticalAlign: "middle",
                        marginRight: 5,
                        color: "#a5b4fc",
                      }}
                    />
                    Users like you typically deposit Nu 500
                  </div>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  {paymentModal === "deposit"
                    ? "Top-up amount (BTN)"
                    : "Cash out amount (BTN)"}
                </p>
                <input
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    fontSize: 18,
                    borderRadius: 12,
                    border: "2px solid var(--glass-border)",
                    background: "var(--bg-main)",
                    color: "var(--text-main)",
                    outline: "none",
                    boxSizing: "border-box",
                    fontWeight: 700,
                  }}
                  type="number"
                  inputMode="numeric"
                  min={paymentModal === "deposit" ? MIN_DEPOSIT : MIN_WITHDRAW}
                  max={paymentModal === "deposit" ? MAX_DEPOSIT : undefined}
                  placeholder="Enter amount"
                  value={payAmountStr}
                  onChange={(e) => {
                    setPayAmountStr(e.target.value);
                    setPayError("");
                  }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(paymentModal === "deposit"
                    ? QUICK_DEPOSIT_AMOUNTS
                    : QUICK_WITHDRAW_AMOUNTS
                  ).map((amt) => (
                    <button
                      key={amt}
                      style={{
                        flex: 1,
                        minWidth: 60,
                        padding: "8px 4px",
                        borderRadius: 8,
                        border:
                          payAmountStr === String(amt)
                            ? "1.5px solid #2775d0"
                            : "1.5px solid var(--glass-border)",
                        background:
                          payAmountStr === String(amt)
                            ? "rgba(39,117,208,0.12)"
                            : "var(--bg-main)",
                        color:
                          payAmountStr === String(amt)
                            ? "#2775d0"
                            : "var(--text-muted)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      DK Account
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {user.dkAccountName || user.dkCid}
                    </span>
                  </div>
                )}
                {paymentModal === "withdraw" && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid var(--glass-border)",
                    }}
                  >
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.25)",
                      fontSize: 13,
                      color: "#dc2626",
                    }}
                  >
                    <XCircle size={14} color="#dc2626" />
                    <span>{payError}</span>
                  </div>
                )}
                <button
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
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
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  An OTP will be sent to your Telegram bot to confirm this
                  transaction.
                </p>
              </div>
            )}

            {/* Step: OTP */}
            {payStep === "otp" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, rgba(37,117,208,0.2), rgba(37,117,208,0.08))",
                    border: "2px solid rgba(37,117,208,0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Smartphone size={28} style={{ color: "#2575d0" }} />
                </div>
                <p
                  style={{
                    margin: "0 0 4px",
                    fontWeight: 800,
                    fontSize: 17,
                    color: "var(--text-main)",
                  }}
                >
                  {paymentModal === "deposit"
                    ? "Confirm Your Deposit"
                    : "Confirm Withdrawal"}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  We sent a code to your{" "}
                  <strong style={{ color: "var(--text-main)" }}>
                    Telegram bot
                  </strong>{" "}
                  to confirm{" "}
                  <strong style={{ color: "#2775d0" }}>
                    Nu {parseFloat(payAmountStr).toLocaleString()}
                  </strong>
                  {paymentModal === "deposit" && isFirstDeposit && (
                    <span style={{ color: "#f59e0b", fontWeight: 700 }}>
                      {" "}
                      (+10% bonus applied!)
                    </span>
                  )}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    margin: "4px 0",
                    width: "100%",
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => {
                    const digit = payOtp[i];
                    const isFilled = !!digit;
                    const isActive = payOtp.length === i;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 44,
                          height: 54,
                          borderRadius: 12,
                          border: isFilled
                            ? "2px solid #2775d0"
                            : isActive
                              ? "2px solid rgba(39,117,208,0.5)"
                              : "2px solid var(--glass-border)",
                          background: isFilled
                            ? "rgba(39,117,208,0.1)"
                            : "var(--bg-main)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#2775d0",
                          transition: "all 0.15s",
                          animation: isFilled
                            ? "otpDigitPop 0.2s ease"
                            : "none",
                          boxShadow: isActive
                            ? "0 0 0 3px rgba(39,117,208,0.15)"
                            : "none",
                        }}
                      >
                        {digit ??
                          (isActive ? (
                            <span
                              style={{
                                width: 2,
                                height: 22,
                                background: "#2775d0",
                                borderRadius: 2,
                                animation:
                                  "nudgePulse 0.8s ease-in-out infinite",
                              }}
                            />
                          ) : (
                            ""
                          ))}
                      </div>
                    );
                  })}
                </div>
                <input
                  style={{
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none",
                    width: 1,
                    height: 1,
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={payOtp}
                  onChange={(e) => {
                    setPayOtp(e.target.value.replace(/\D/g, ""));
                    setPayError("");
                  }}
                  autoFocus
                  id="otp-hidden-input"
                />
                <button
                  onClick={() =>
                    document.getElementById("otp-hidden-input")?.focus()
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
                    border: "1.5px dashed var(--glass-border)",
                    background: "transparent",
                    color: "var(--text-subtle)",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Smartphone size={14} /> Tap here to enter OTP
                </button>
                {payError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.25)",
                      fontSize: 13,
                      color: "#dc2626",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <XCircle size={14} color="#dc2626" />
                    <span>{payError}</span>
                  </div>
                )}
                <button
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
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
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid var(--glass-border)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
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

            {/* Step: Success */}
            {payStep === "success" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                  alignItems: "center",
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {showCoins && paymentModal === "deposit" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      zIndex: 10,
                      overflow: "hidden",
                    }}
                  >
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: `${(i * 37 + 11) % 100}%`,
                          top: 0,
                          width: [8, 10, 7, 9][i % 4],
                          height: [8, 10, 7, 9][i % 4],
                          borderRadius: i % 3 === 0 ? "50%" : 2,
                          background: [
                            "#6366f1",
                            "#f59e0b",
                            "#10b981",
                            "#ec4899",
                          ][i % 4],
                          animation: `coinFall ${1.2 + (i % 5) * 0.36}s ease-in ${(i % 4) * 0.2}s both`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    animation:
                      paymentModal === "deposit"
                        ? "depositSuccessPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, depositSuccessGlow 1.5s ease 0.55s 2"
                        : "none",
                  }}
                >
                  <CheckCircle
                    size={38}
                    style={{
                      color: "#059669",
                      animation:
                        "depositSuccessPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
                    }}
                  />
                </div>
                <p
                  style={{
                    fontWeight: 800,
                    fontSize: 20,
                    margin: "0 0 6px",
                    color:
                      paymentModal === "deposit"
                        ? "#059669"
                        : "var(--text-main)",
                  }}
                >
                  {paymentModal === "deposit"
                    ? "Deposit Confirmed!"
                    : "Withdrawal Confirmed!"}
                </p>
                {paymentModal === "deposit" && (
                  <div
                    style={{
                      margin: "8px 0 14px",
                      padding: "12px 20px",
                      borderRadius: 12,
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-subtle)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      New Balance
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: "#10b981",
                      }}
                    >
                      BTN{" "}
                      <AnimatedCounter
                        value={
                          depositPrevBalance.current + parseFloat(payAmountStr)
                        }
                      />
                    </div>
                    {isFirstDeposit && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#f59e0b",
                          fontWeight: 700,
                          marginTop: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Gift size={13} color="#f59e0b" /> +10% bonus included!
                      </div>
                    )}
                  </div>
                )}
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
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={closePaymentModal}
                >
                  Done
                </button>
              </div>
            )}

            {/* Step: Failed */}
            {payStep === "failed" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "20px",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <XCircle size={56} color="#dc2626" />
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
                  style={{
                    width: "100%",
                    padding: "15px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setPayStep("amount");
                    setPayError("");
                  }}
                >
                  Try Again
                </button>
                <button
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid var(--glass-border)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  onClick={closePaymentModal}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

const balanceCard: React.CSSProperties = {
  background: "var(--balance-card-bg)",
  borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
  padding: "var(--space-md) var(--space-md) var(--space-lg)",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "var(--balance-card-shadow)",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const actionBtnPrimary: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "14px 20px",
  borderRadius: "var(--radius-md)",
  border: "none",
  background: "var(--grad-primary)",
  color: "#fff",
  fontWeight: 800,
  fontSize: "0.95rem",
  cursor: "pointer",
  boxShadow: "0 8px 20px -6px rgba(39, 117, 208, 0.5)",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
};

const actionBtnSecondary: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "14px 20px",
  borderRadius: "var(--radius-md)",
  border: "1.5px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-main)",
  fontWeight: 800,
  fontSize: "0.95rem",
  cursor: "pointer",
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  boxShadow: "var(--shadow-sm)",
};

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 16,
  padding: "18px 16px",
  boxShadow: "var(--shadow-sm)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  margin: "0 16px",
};
