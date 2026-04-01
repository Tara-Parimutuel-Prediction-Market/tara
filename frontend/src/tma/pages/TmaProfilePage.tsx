import { FC, useState, useEffect } from "react";
import { useAuth } from "@/tma/hooks/useAuth";
import {
  linkDKBank,
  getMe,
  getMyTransactions,
  AuthUser,
  Transaction,
} from "@/api/client";
import { Page } from "@/tma/components/Page";
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

  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "wallet" && txs.length === 0 && !txLoading) {
      setTxLoading(true);
      getMyTransactions()
        .then(setTxs)
        .catch((e) => setTxError(e.message))
        .finally(() => setTxLoading(false));
    }
  }, [activeTab]);

  const user = freshUser ?? authUser;
  const loading = authLoading && freshLoading;

  const [cid, setCid] = useState("");
  const [step, setStep] = useState<LinkStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [linkedName, setLinkedName] = useState("");

  const hasDKBank = !!user?.dkCid;
  const hasPhoneVerified = !!user?.telegramPhoneHash;

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
                label="DK Bank"
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

            {/* ── DK Bank link form ──────────────────────────────── */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>
                <span style={styles.titleRow}>
                  {hasDKBank ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : (
                    <Link2 size={16} color="#2775d0" />
                  )}
                  {hasDKBank ? "DK Bank Linked" : "Link DK Bank Account"}
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
                    <span style={styles.label}>Phone hash</span>
                    <span style={{ ...styles.value, ...styles.inlineIcon }}>
                      {user?.dkPhoneHash ? (
                        <>
                          <ShieldCheck size={13} color="#059669" />
                          {user.dkPhoneHash.slice(0, 8)}…
                        </>
                      ) : (
                        <span
                          style={{ color: "#d97706", ...styles.inlineIcon }}
                        >
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
                      DK Bank account linked
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
                          Link DK Bank Account
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
            {txLoading && (
              <div style={styles.center}>
                <div style={styles.spinner} />
              </div>
            )}

            {txError && (
              <div style={walletStyles.emptyState}>
                <AlertCircle size={48} color="#ef4444" />
                <p style={{ color: "#ef4444" }}>{txError}</p>
              </div>
            )}

            {!txLoading && !txError && (
              <>
                {/* Balance card */}
                <div style={walletStyles.balanceCard}>
                  <div style={walletStyles.balanceLabel}>Available Balance</div>
                  <div style={walletStyles.balanceAmount}>
                    <span style={walletStyles.balanceCurrency}>BTN</span>
                    {Number(user?.creditsBalance ?? 0).toLocaleString()}
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
                      {txs.length} transaction{txs.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Clock
                    size={16}
                    color="#9ca3af"
                    style={{ marginBottom: 20 }}
                  />
                </div>

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
              </>
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
  label: string;
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
    color: "#111",
  },
  username: {
    margin: 0,
    fontSize: 14,
    color: "#6b7280",
  },
  tabBar: {
    display: "flex",
    background: "#f3f4f6",
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
    color: "#6b7280",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#fff",
    color: "#2775d0",
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
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
    background: "#fff",
    borderRadius: 16,
    padding: "18px 16px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: "#111",
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
    color: "#6b7280",
    lineHeight: 1.6,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: 16,
    borderRadius: 10,
    border: "1.5px solid #d1d5db",
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
    color: "#6b7280",
    fontWeight: 500,
  },
  value: {
    color: "#111",
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
    background: "rgb(100, 184, 226)",
    borderRadius: 20,
    padding: "28px 20px",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 16px 32px -8px rgba(39,117,208,0.35)",
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
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    color: "#111",
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
    background: "linear-gradient(135deg, #2775d0, #1a5bb5)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#111",
  },
  sectionSubtitle: {
    fontSize: "0.8rem",
    color: "#9ca3af",
    marginTop: 3,
    marginBottom: 0,
  },
  txList: {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    border: "1px solid #f1f5f9",
  },
  txRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderBottom: "1px solid #f1f5f9",
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    background: "#f1f5f9",
    color: "#6b7280",
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txLabel: {
    fontWeight: 600,
    fontSize: "0.9rem",
    color: "#111",
    marginBottom: 2,
  },
  txNote: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  txDate: {
    fontSize: "0.72rem",
    color: "#9ca3af",
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
    color: "#9ca3af",
    marginTop: 2,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "40px 20px",
    color: "#9ca3af",
  },
};
