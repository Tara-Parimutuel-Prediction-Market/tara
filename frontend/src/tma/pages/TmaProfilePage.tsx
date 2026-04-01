import { FC, useState, useEffect } from "react";
import { useAuth } from "@/tma/hooks/useAuth";
import { linkDKBank, getMe, AuthUser } from "@/api/client";
import { Page } from "@/tma/components/Page";
import {
  CheckCircle2,
  XCircle,
  Link2,
  Smartphone,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type LinkStep = "idle" | "loading" | "success" | "error";

export const TmaProfilePage: FC = () => {
  const { user: authUser, loading: authLoading, retry } = useAuth();

  const [freshUser, setFreshUser] = useState<AuthUser | null>(null);
  const [freshLoading, setFreshLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setFreshUser)
      .catch(() => setFreshUser(authUser))
      .finally(() => setFreshLoading(false));
  }, []);

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
                <span style={styles.value}>{user?.dkAccountName || "—"}</span>
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
                Enter your 11-digit Bhutanese National ID (CID) to link your DK
                Bank account. This stores a secure hash of your registered phone
                number so payments can be verified.
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
                  DK Bank account linked{linkedName ? ` as ${linkedName}` : ""}!
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
                <Step n={1} done={hasDKBank} text="Link DK Bank CID (above)" />
                <Step
                  n={2}
                  done={false}
                  text='Open Tara bot → send "/verify"'
                />
                <Step n={3} done={false} text="Tap Share Phone Number button" />
                <Step
                  n={4}
                  done={hasPhoneVerified}
                  text="Phone verified — payments unlocked!"
                />
              </div>
            </>
          )}
        </div>
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
