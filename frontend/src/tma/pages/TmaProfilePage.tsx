import { FC, useState, useEffect } from "react";
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
  Medal,
  ChevronDown,
  Flame,
  Lightbulb,
  TrendingUp,
  Activity,
  Award,
  ThumbsUp,
  Eye,
  EyeOff,
  Crosshair,
  Sparkles,
  Zap,
  Star,
  Hash,
  Brain,
  Dumbbell,
  Sprout,
  Swords,
  Building2,
  BarChart2,
} from "lucide-react";

type LinkStep = "idle" | "loading" | "success" | "error";

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

const TX_ICON: Record<Transaction["type"], React.ReactNode> = {
  deposit: <ArrowDownLeft size={20} />,
  withdrawal: <ArrowUpRight size={20} />,
  bet_placed: <Target size={20} />,
  bet_payout: <Trophy size={20} />,
  refund: <RotateCcw size={20} />,
  dispute_bond: <Lock size={20} />,
  dispute_refund: <Unlock size={20} />,
};

const TX_LABEL: Record<Transaction["type"], string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  bet_placed: "Position opened",
  bet_payout: "Returns",
  refund: "Refund",
  dispute_bond: "Dispute bond",
  dispute_refund: "Bond refund",
};

function TxRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.amount > 0;
  return (
    <div style={walletStyles.txRow}>
      <div style={walletStyles.txIcon}>{TX_ICON[tx.type]}</div>
      <div style={walletStyles.txInfo}>
        <div style={walletStyles.txLabel}>{TX_LABEL[tx.type]}</div>
        {tx.note && <div style={walletStyles.txNote}>{tx.note}</div>}
        <div style={walletStyles.txDate}>
          {new Date(tx.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div style={walletStyles.txAmountCol}>
        <div
          style={{
            ...walletStyles.txAmount,
            color: isCredit ? "#059669" : "#dc2626",
          }}
        >
          {isCredit ? "+" : ""}
          {Number(tx.amount).toLocaleString()}
        </div>
        <div style={walletStyles.txBalance}>
          Bal {Number(tx.balanceAfter).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export const TmaProfilePage: FC = () => {
  const { user: authUser, loading: authLoading, retry } = useAuth();

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
      .then(setFreshUser)
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

  const [badgesOpen, setBadgesOpen] = useState(false);
  const [showAllTxs, setShowAllTxs] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [streakModalOpen, setStreakModalOpen] = useState(false);

  const [cid, setCid] = useState("");
  const [step, setStep] = useState<LinkStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedName, setLinkedName] = useState("");

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
        `Minimum ${paymentModal === "deposit" ? "deposit" : "withdrawal"} is Nu ${minAmt}.`,
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
          ? `Nu ${parseFloat(payAmountStr).toLocaleString()} deposited successfully!`
          : `Nu ${parseFloat(payAmountStr).toLocaleString()} withdrawal confirmed. Funds on their way to DK Bank.`,
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
      await retry();
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

  const totalIn = txs
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = txs
    .filter((t) => Number(t.amount) < 0)
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
      `}</style>
      <div style={styles.container}>
        {/* ── Hero: Avatar + Balance ────────────────────────── */}
        <div style={styles.heroCard}>
          {/* Avatar + name */}
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
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {user?.firstName} {user?.lastName || ""}
                  {(user?.betStreakCount ?? 0) > 0 && (
                    <button
                      onClick={() => setStreakModalOpen(true)}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #f97316)',
                        border: 'none',
                        borderRadius: 12,
                        padding: '0px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        animation: 'streakFire 2s ease-in-out infinite',
                        boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
                      }}
                    >
                      <Flame size={14} color="#fff" fill="#fff" />
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                        {user?.betStreakCount}
                      </span>
                    </button>
                  )}
                </div>
              {user?.username && (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.65)",
                    marginTop: 2,
                  }}
                >
                  @{user.username}
                </div>
              )}
              {/* Status chips */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: hasDKBank
                      ? "rgba(16,185,129,0.25)"
                      : "rgba(239,68,68,0.25)",
                    color: hasDKBank ? "#6ee7b7" : "#fca5a5",
                    border: `1px solid ${hasDKBank ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                  }}
                >
                  {hasDKBank ? "✓ DK Bank" : "DK Bank"}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: hasPhoneVerified
                      ? "rgba(16,185,129,0.25)"
                      : "rgba(239,68,68,0.25)",
                    color: hasPhoneVerified ? "#6ee7b7" : "#fca5a5",
                    border: `1px solid ${hasPhoneVerified ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                  }}
                >
                  {hasPhoneVerified ? "✓ Phone" : "Phone"}
                </span>
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
                label: "Total In",
                value: `+${totalIn.toLocaleString()}`,
                color: "#6ee7b7",
              },
              {
                label: "Total Out",
                value: Math.abs(totalOut).toLocaleString(),
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
            Deposit
          </button>
          <button
            style={styles.actionBtnSecondary}
            onClick={() => openPaymentModal("withdraw")}
          >
            <ArrowUpCircle size={16} />
            Withdraw
          </button>
        </div>

        {/* ── DK Bank ── only show if not fully linked, or if linked but phone not yet verified */}
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
                        />
                        Linking…
                      </>
                    ) : (
                      <>
                        <Link2 size={15} />
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
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
                      </>
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

        {/* ── Collectible Badges ────────────────────────────── */}
        <div style={{ padding: "0 16px" }}>
          <BadgeGrid
            totalPredictions={user?.totalPredictions ?? 0}
            correctPredictions={user?.correctPredictions ?? 0}
            reputationTier={user?.reputationTier ?? "newcomer"}
            reputationScore={user?.reputationScore ?? 0}
            hasPhone={hasPhoneVerified}
            hasDKBank={hasDKBank}
            open={badgesOpen}
            onToggle={() => setBadgesOpen((o) => !o)}
          />
        </div>

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
                    .map((tx) => <TxRow key={tx.id} tx={tx} />)
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
                  {paymentModal === "deposit" ? "Deposit via" : "Withdraw to"}
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
                      Link your DK Bank account (Profile tab) before depositing.
                    </span>
                  </div>
                )}
                {paymentModal === "withdraw" && !user?.dkCid && (
                  <div style={modalStyles.warningBox}>
                    <AlertCircle size={14} color="#d97706" />
                    <span>You need a linked DK Bank account to withdraw.</span>
                  </div>
                )}

                <p style={modalStyles.label}>
                  {paymentModal === "deposit"
                    ? "Top-up amount (BTN)"
                    : "Withdrawal amount (BTN)"}
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
    </Page>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

type CollectibleBadge = {
  id: string;
  icon: React.ReactNode;
  name: string;
  desc: string;
  unlocked: boolean;
};

function buildBadges(
  total: number,
  correct: number,
  tier: string,
  score: number,
  hasPhone: boolean,
  hasDK: boolean,
): CollectibleBadge[] {
  const acc = total > 0 ? correct / total : 0;

  return [
    // ── Volume ──
    {
      id: "first_call",
      icon: <Target size={18} color="#3b82f6" />,
      name: "First Call",
      desc: "Make your first prediction",
      unlocked: total >= 1,
    },
    {
      id: "triple",
      icon: <Flame size={18} color="#f97316" />,
      name: "Triple Threat",
      desc: "Make 3 predictions",
      unlocked: total >= 3,
    },
    {
      id: "sharp_start",
      icon: <Lightbulb size={18} color="#eab308" />,
      name: "Sharp Start",
      desc: "Make 5 predictions",
      unlocked: total >= 5,
    },
    {
      id: "ten_deep",
      icon: <TrendingUp size={18} color="#22c55e" />,
      name: "Ten Deep",
      desc: "Make 10 predictions",
      unlocked: total >= 10,
    },
    {
      id: "committed",
      icon: <Activity size={18} color="#06b6d4" />,
      name: "Committed",
      desc: "Make 25 predictions",
      unlocked: total >= 25,
    },
    {
      id: "centurion",
      icon: <Award size={18} color="#a855f7" />,
      name: "Centurion",
      desc: "Make 100 predictions",
      unlocked: total >= 100,
    },
    // ── Accuracy ──
    {
      id: "above_avg",
      icon: <ThumbsUp size={18} color="#3b82f6" />,
      name: "Above Average",
      desc: "Hit 50%+ accuracy (5+ predictions)",
      unlocked: total >= 5 && acc >= 0.5,
    },
    {
      id: "eagle_eye",
      icon: <Eye size={18} color="#0ea5e9" />,
      name: "Eagle Eye",
      desc: "Hit 60%+ accuracy (10+ predictions)",
      unlocked: total >= 10 && acc >= 0.6,
    },
    {
      id: "sharpened",
      icon: <Crosshair size={18} color="#10b981" />,
      name: "Sharpened",
      desc: "Hit 70%+ accuracy (15+ predictions)",
      unlocked: total >= 15 && acc >= 0.7,
    },
    {
      id: "oracle",
      icon: <Sparkles size={18} color="#8b5cf6" />,
      name: "Oracle",
      desc: "Hit 75%+ accuracy (20+ predictions)",
      unlocked: total >= 20 && acc >= 0.75,
    },
    {
      id: "electrified",
      icon: <Zap size={18} color="#f59e0b" />,
      name: "Electrified",
      desc: "Hit 80%+ accuracy (30+ predictions)",
      unlocked: total >= 30 && acc >= 0.8,
    },
    {
      id: "godlike",
      icon: <Star size={18} color="#f59e0b" />,
      name: "Godlike",
      desc: "Hit 85%+ accuracy (50+ predictions)",
      unlocked: total >= 50 && acc >= 0.85,
    },
    // ── Correct calls ──
    {
      id: "right_once",
      icon: <CheckCircle2 size={18} color="#22c55e" />,
      name: "Right Once",
      desc: "Get 1 correct prediction",
      unlocked: correct >= 1,
    },
    {
      id: "double_digit",
      icon: <Hash size={18} color="#14b8a6" />,
      name: "Double Digit",
      desc: "Get 10 correct predictions",
      unlocked: correct >= 10,
    },
    {
      id: "think_tank",
      icon: <Brain size={18} color="#6366f1" />,
      name: "Think Tank",
      desc: "Get 25 correct predictions",
      unlocked: correct >= 25,
    },
    {
      id: "half_century",
      icon: <Dumbbell size={18} color="#ec4899" />,
      name: "Half Century",
      desc: "Get 50 correct predictions",
      unlocked: correct >= 50,
    },
    // ── Tiers ──
    {
      id: "rookie",
      icon: <Sprout size={18} color="#84cc16" />,
      name: "Rookie",
      desc: "Join as a Rookie",
      unlocked: true,
    },
    {
      id: "sharpshooter",
      icon: <Swords size={18} color="#3b82f6" />,
      name: "Sharpshooter",
      desc: "Reach Sharpshooter tier",
      unlocked: ["regular", "reliable", "expert"].includes(tier),
    },
    {
      id: "hot_hand",
      icon: <Flame size={18} color="#ef4444" />,
      name: "Hot Hand",
      desc: "Reach Hot Hand tier",
      unlocked: ["reliable", "expert"].includes(tier),
    },
    {
      id: "legend",
      icon: <Trophy size={18} color="#f59e0b" />,
      name: "Legend",
      desc: "Reach Legend tier",
      unlocked: tier === "expert",
    },
    // ── Profile ──
    {
      id: "verified",
      icon: <Smartphone size={18} color="#6366f1" />,
      name: "Verified",
      desc: "Verify your phone number",
      unlocked: hasPhone,
    },
    {
      id: "bankrolled",
      icon: <Building2 size={18} color="#0ea5e9" />,
      name: "Bankrolled",
      desc: "Link your DK Bank account",
      unlocked: hasDK,
    },
    {
      id: "connected",
      icon: <Link2 size={18} color="#10b981" />,
      name: "Connected",
      desc: "Link phone and DK Bank",
      unlocked: hasPhone && hasDK,
    },
    {
      id: "high_score",
      icon: <BarChart2 size={18} color="#f59e0b" />,
      name: "High Score",
      desc: "Reach 70%+ reputation score",
      unlocked: score >= 0.7,
    },
  ];
}

function BadgeGrid({
  totalPredictions,
  correctPredictions,
  reputationTier,
  reputationScore,
  hasPhone,
  hasDKBank,
  open,
  onToggle,
}: {
  totalPredictions: number;
  correctPredictions: number;
  reputationTier: string;
  reputationScore: number;
  hasPhone: boolean;
  hasDKBank: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const badges = buildBadges(
    totalPredictions,
    correctPredictions,
    reputationTier,
    reputationScore,
    hasPhone,
    hasDKBank,
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const total = badges.length;
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        padding: 16,
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: open ? 12 : 0,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggle}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-main)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Medal size={16} color="#f59e0b" /> Collectibles
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: unlockedCount > 0 ? "#f59e0b" : "var(--text-subtle)",
              background: unlockedCount > 0 ? "#fef3c7" : "var(--bg-secondary)",
              padding: "2px 10px",
              borderRadius: 99,
            }}
          >
            {unlockedCount}/{total} unlocked
          </span>
          <ChevronDown
            size={16}
            style={{
              transition: "transform 0.2s",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              color: "var(--text-subtle)",
            }}
          />
        </div>
      </div>
      {open && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
          }}
        >
          {badges.map((b) => (
            <div
              key={b.id}
              title={`${b.name}: ${b.desc}`}
              onMouseEnter={() => setHovered(b.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                cursor: "default",
                opacity: b.unlocked ? 1 : 0.28,
                filter: b.unlocked ? "none" : "grayscale(1)",
                transition: "opacity 0.2s",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: b.unlocked
                    ? "var(--bg-secondary)"
                    : "var(--bg-secondary)",
                  border: b.unlocked
                    ? "1.5px solid #f59e0b44"
                    : "1.5px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: b.unlocked
                    ? "0 0 8px rgba(245,158,11,0.18)"
                    : "none",
                }}
              >
                {b.unlocked ? b.icon : <Lock size={16} color="#9ca3af" />}
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "var(--text-subtle)",
                  textAlign: "center",
                  lineHeight: 1.2,
                  maxWidth: 44,
                }}
              >
                {b.name}
              </span>
              {hovered === b.id && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#1f2937",
                    color: "#f9fafb",
                    fontSize: 11,
                    padding: "5px 8px",
                    borderRadius: 8,
                    whiteSpace: "nowrap",
                    zIndex: 10,
                    pointerEvents: "none",
                    marginBottom: 4,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  }}
                >
                  {b.desc}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
