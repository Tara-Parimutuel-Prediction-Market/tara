import { FC, useState, useEffect, ReactNode } from "react";
import dkBankLogo from "../../../assets/dk blue.png";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  linkDKBank,
  getMe,
  getMyTransactions,
  AuthUser,
  Transaction,
} from "@/api/client";
import { Page } from "@/tma/components/Page";
import { ThemeToggle } from "@/components/ThemeToggle";
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
} from "lucide-react";

type LinkStep = "idle" | "loading" | "success" | "error";
type ActiveTab = "profile" | "wallet";

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
  bet_placed: "Bet placed",
  bet_payout: "Winnings",
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

  const [activeTab, setActiveTab] = useState<ActiveTab>("profile");
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
    if (activeTab === "wallet") {
      refreshWallet();
    }
  }, [activeTab]);

  const user = freshUser ?? authUser;
  const loading = authLoading && freshLoading;

  const [cid, setCid] = useState("");
  const [step, setStep] = useState<LinkStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedName, setLinkedName] = useState("");

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

  return (
    <Page>
      <div style={styles.container}>
        {/* Top Header Layer: Toggles */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <ThemeToggle />
        </div>

        {/* ── Avatar / Name ──────────────────────────────────── */}
        <div style={styles.avatarSection}>
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt="avatar" style={styles.avatar} />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {(user?.firstName?.[0] || "?").toUpperCase()}
            </div>
          )}
          <h2 style={styles.name}>
            {user?.firstName} {user?.lastName || ""}
          </h2>
          {user?.username && <p style={styles.username}>@{user.username}</p>}
        </div>

        {/* ── Tab Switcher ───────────────────────────────────── */}
        <div style={styles.tabBar}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "profile" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "wallet" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("wallet")}
          >
            <Wallet size={14} style={{ marginRight: 5 }} />
            Wallet
          </button>
        </div>

        {/* ── Profile Tab ────────────────────────────────────── */}
        {activeTab === "profile" && (
          <>
            {/* ── Status badges ──────────────────────────────────── */}
            <div style={styles.badgeRow}>
              <StatusBadge
                label={<img src={dkBankLogo} alt="DK Bank" style={{ height: 13, width: "auto", mixBlendMode: "multiply" }} />}
                active={hasDKBank}
                activeText={user?.dkAccountName || user?.dkCid || "Linked"}
                inactiveText="Not linked"
              />
              <StatusBadge
                label="Phone"
                active={hasPhoneVerified}
                activeText="Verified"
                inactiveText="Not verified"
              />
            </div>

            {/* ── Reputation Card ────────────────────────────────── */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <span style={styles.titleRow}>
                  <Trophy size={16} color="#f59e0b" />
                  Prediction Reputation
                </span>
              </h3>
              {(user?.totalPredictions ?? 0) === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-subtle)", lineHeight: 1.5 }}>
                  <p style={{ margin: "0 0 8px" }}>
                    Make your first prediction to start building your reputation score.
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-subtle)" }}>
                    Top predictors earn an Expert badge and their predictions carry
                    more weight in market probabilities.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 10px",
                      borderRadius: 99,
                      background:
                        user?.reputationTier === "expert" ? "#fef3c7" :
                        user?.reputationTier === "reliable" ? "#d1fae5" :
                        user?.reputationTier === "regular" ? "#dbeafe" : "#f3f4f6",
                      color:
                        user?.reputationTier === "expert" ? "#92400e" :
                        user?.reputationTier === "reliable" ? "#065f46" :
                        user?.reputationTier === "regular" ? "#1e40af" : "#374151",
                      textTransform: "capitalize",
                    }}>
                      {user?.reputationTier === "expert" ? "Expert" :
                       user?.reputationTier === "reliable" ? "Reliable" :
                       user?.reputationTier === "regular" ? "Regular" : "Newcomer"}
                    </span>
                    {user?.reputationScore != null && (
                      <span style={{ fontSize: 13, color: "var(--text-subtle)" }} title="Confidence-adjusted score — grows more accurate as you make more predictions">
                        {Math.round(user.reputationScore * 100)}% confidence score
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text-subtle)" }}>
                    <span>
                      <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>
                        {user?.totalPredictions ?? 0}
                      </strong>{" "}predictions
                    </span>
                    <span>
                      <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>
                        {user?.correctPredictions ?? 0}
                      </strong>{" "}correct
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── DK Bank link form ──────────────────────────────── */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <span style={styles.titleRow}>
                  {hasDKBank ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : (
                    <Link2 size={16} color="#2775d0" />
                  )}
                  {hasDKBank ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#fff", borderRadius: 4, padding: "1px 5px", display: "inline-flex", alignItems: "center" }}><img src={dkBankLogo} alt="DK Bank" style={{ height: 14, width: "auto" }} /></span>
                      Linked
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      Link
                      <img src={dkBankLogo} alt="DK Bank" style={{ height: 14, width: "auto", mixBlendMode: "multiply" }} />
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
                    <span style={styles.value}>
                      {user?.dkAccountName || "—"}
                    </span>
                  </p>
                  <p style={styles.linkedRow}>
                    <span style={styles.label}>Phone</span>
                    <span style={{ ...styles.value, ...styles.inlineIcon }}>
                      {user?.isDkPhoneLinked ? (
                        <>
                          <ShieldCheck size={13} color="#059669" />
                          Registered
                        </>
                      ) : (
                        <span style={{ color: "#d97706", ...styles.inlineIcon }}>
                          <AlertCircle size={13} color="#d97706" />
                          No phone on DK Bank record
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              ) : (
                <>
                  <p style={styles.hint}>
                    Enter your 11-digit Bhutanese National ID (CID) to link your
                    DK Bank account. This stores a secure hash of your
                    registered phone number so payments can be verified.
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <img src={dkBankLogo} alt="DK Bank" style={{ height: 13, width: "auto", mixBlendMode: "multiply" }} />
                        account linked
                      </span>
                      {linkedName ? ` as ${linkedName}` : ""}!
                    </p>
                  )}
                  <button
                    style={{
                      ...styles.btn,
                      opacity:
                        step === "loading" || cid.length !== 11 ? 0.6 : 1,
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
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            Link
                            <img src={dkBankLogo} alt="DK Bank" style={{ height: 13, width: "auto", mixBlendMode: "multiply" }} />
                            Account
                          </span>
                        </>
                      )}
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* ── Phone verification instructions ───────────────── */}
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
                    After linking your DK Bank CID above, go to the Tara bot and
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
                      text='Open Tara bot → send "/verify"'
                    />
                    <Step
                      n={3}
                      done={false}
                      text="Tap Share Phone Number button"
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
          </>
        )}

        {/* ── Wallet Tab ─────────────────────────────────────── */}
        {activeTab === "wallet" && (
          <>
            {/* Balance card — always shown, amount pulses while loading */}
            <div style={walletStyles.balanceCard}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={walletStyles.balanceLabel}>Available Balance</div>
                <button
                  onClick={refreshWallet}
                  disabled={balanceLoading || txLoading}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    borderRadius: 8,
                    padding: "4px 8px",
                    cursor:
                      balanceLoading || txLoading ? "not-allowed" : "pointer",
                    color: "#fff",
                    opacity: balanceLoading || txLoading ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  <RotateCcw
                    size={12}
                    style={
                      balanceLoading
                        ? { animation: "spin 0.8s linear infinite" }
                        : {}
                    }
                  />
                  Refresh
                </button>
              </div>
              <div
                style={{
                  ...walletStyles.balanceAmount,
                  opacity: balanceLoading ? 0.5 : 1,
                  transition: "opacity 0.3s",
                }}
              >
                <span style={walletStyles.balanceCurrency}>BTN</span>
                {Number(
                  freshUser?.creditsBalance ?? user?.creditsBalance ?? 0,
                ).toLocaleString()}
              </div>
              <div style={walletStyles.balanceStats}>
                <div style={walletStyles.statItem}>
                  <div style={walletStyles.statLabel}>Total In</div>
                  <div style={walletStyles.statValue}>
                    +{totalIn.toLocaleString()}
                  </div>
                </div>
                <div style={walletStyles.statItem}>
                  <div style={walletStyles.statLabel}>Total Out</div>
                  <div style={walletStyles.statValue}>
                    {Math.abs(totalOut).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={walletStyles.walletActions}>
              <button style={walletStyles.actionBtnPrimary}>
                <Plus size={18} />
                Deposit
              </button>
              <button style={walletStyles.actionBtn}>
                <ArrowUpCircle size={18} />
                Withdraw
              </button>
            </div>

            {/* Transaction history */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: 12,
              }}
            >
              <div>
                <h2 style={walletStyles.sectionTitle}>History</h2>
                <div style={walletStyles.sectionSubtitle}>
                  {txLoading
                    ? "Updating…"
                    : `${txs.length} transaction${txs.length !== 1 ? "s" : ""}`}
                </div>
              </div>
              <Clock size={16} color="#9ca3af" style={{ marginBottom: 20 }} />
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
              <div style={walletStyles.txList}>
                {txs.length === 0 ? (
                  <div style={walletStyles.emptyState}>
                    <Wallet size={48} color="#9ca3af" />
                    <p style={{ color: "#9ca3af" }}>No transactions yet</p>
                  </div>
                ) : (
                  txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({
  label,
  active,
  activeText,
  inactiveText,
}: {
  label: ReactNode;
  active: boolean;
  activeText: string;
  inactiveText: string;
}) {
  return (
    <div
      style={{
        ...styles.badge,
        background: active ? "#d1fae5" : "#fee2e2",
        borderColor: active ? "#6ee7b7" : "#fca5a5",
      }}
    >
      <span style={styles.badgeLabel}>{label}</span>
      <span
        style={{
          ...styles.badgeValue,
          ...styles.inlineIcon,
          color: active ? "#065f46" : "#991b1b",
        }}
      >
        {active ? (
          <>
            <CheckCircle2 size={12} />
            {activeText}
          </>
        ) : (
          <>
            <XCircle size={12} />
            {inactiveText}
          </>
        )}
      </span>
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
    padding: "16px 16px 100px",
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
  avatarSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #2775d0",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2775d0, #5b9bd5)",
    color: "#fff",
    fontSize: 32,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text-main)",
  },
  username: {
    margin: 0,
    fontSize: 14,
    color: "var(--text-muted)",
  },
  tabBar: {
    display: "flex",
    background: "var(--bg-card)",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "var(--bg-main)",
    color: "#2775d0",
    boxShadow: "var(--shadow-sm)",
  },
  badgeRow: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
  },
  badge: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid",
    maxWidth: 180,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#6b7280",
  },
  badgeValue: {
    fontSize: 13,
    fontWeight: 600,
  },
  card: {
    background: "var(--bg-card)",
    borderRadius: 16,
    padding: "18px 16px",
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
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
    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
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
    color: "#fff",
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
