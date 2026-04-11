import { FC, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "@/tma/components/Page";
import { useAuth } from "@/tma/hooks/useAuth";
import { linkDKBank, getMe, type AuthUser } from "@/api/client";
import {
  ChevronLeft,
  Copy,
  Check,
  Send,
  User,
  Building2,
  Info,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  ExternalLink,
  Smartphone,
  Calendar,
} from "lucide-react";

const BOT_USERNAME = "OroPredictBot";

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: "var(--text-subtle)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        padding: "0 16px",
        marginBottom: 8,
        marginTop: 24,
      }}
    >
      {label}
    </div>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────
function SettingsRow({
  icon,
  label,
  value,
  valueColor,
  onClick,
  children,
  noBorder,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueColor?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: "var(--bg-card)",
        borderBottom: noBorder ? "none" : "1px solid var(--glass-border)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "var(--text-muted)",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}
        >
          {label}
        </div>
        {value && (
          <div
            style={{
              fontSize: 12,
              color: valueColor ?? "var(--text-subtle)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export const TmaSettingsPage: FC = () => {
  const navigate = useNavigate();
  const { user: authUser, retry } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(null);

  const [copied, setCopied] = useState(false);
  const [cidInput, setCidInput] = useState("");
  const [linkStep, setLinkStep] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(authUser));
  }, []);

  const currentUser = user ?? authUser;
  const refId = currentUser?.telegramId ?? currentUser?.id ?? "";
  const refLink = `https://t.me/${BOT_USERNAME}/app?startapp=ref_${refId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const text = `🏆 I'm predicting on Oro — join me and let's see who's sharper!\n\n${refLink}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleLinkDKBank = async () => {
    if (cidInput.length !== 11) {
      setLinkError("CID must be exactly 11 digits.");
      setLinkStep("error");
      return;
    }
    setLinkStep("loading");
    setLinkError("");
    try {
      const res = await linkDKBank(cidInput);
      setUser(res.user);
      await retry();
      setLinkStep("success");
    } catch (err: any) {
      setLinkError(err.message || "Failed to link CID. Please try again.");
      setLinkStep("error");
    }
  };

  const hasDKBank = !!currentUser?.dkCid;
  const hasPhone = !!currentUser?.isPhoneVerified;
  const memberSince = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <Page>
      <div style={{ paddingBottom: 100, minHeight: "100vh" }}>
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "20px 16px 16px",
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--glass-border)",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-main)",
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: "var(--text-main)",
              letterSpacing: "-0.02em",
            }}
          >
            Settings
          </h1>
        </div>

        {/* ══════════════════════════════════════════════════════
            REFERRAL LINK — most prominent
        ══════════════════════════════════════════════════════ */}
        <div style={{ padding: "0 16px", marginTop: 8 }}>
          <div
            style={{
              background: "linear-gradient(135deg, #1e3a5f, #1a2e4a)",
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 18,
              padding: "18px 16px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* glow */}
            <div
              style={{
                position: "absolute",
                top: -40,
                right: -40,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "rgba(59,130,246,0.15)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#93c5fd",
                marginBottom: 4,
              }}
            >
              Your Referral Link
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 14,
              }}
            >
              Invite friends — earn perks when they join and predict
            </div>

            {/* Link display */}
            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 12,
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
                wordBreak: "break-all",
                lineHeight: 1.4,
              }}
            >
              {refLink}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "11px 0",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: copied
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(255,255,255,0.08)",
                  color: copied ? "#4ade80" : "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied!" : "Copy Link"}
              </button>

              <button
                onClick={handleShare}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "11px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Send size={15} />
                Share via Telegram
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            ACCOUNT
        ══════════════════════════════════════════════════════ */}
        <SectionLabel label="Account" />
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            margin: "0 16px",
            border: "1px solid var(--glass-border)",
            overflow: "hidden",
          }}
        >
          <SettingsRow
            icon={<User size={17} />}
            label="Name"
            value={
              [currentUser?.firstName, currentUser?.lastName]
                .filter(Boolean)
                .join(" ") || "—"
            }
          />
          <SettingsRow
            icon={<span style={{ fontSize: 16 }}>@</span>}
            label="Username"
            value={
              currentUser?.username
                ? `@${currentUser.username}`
                : "No username set"
            }
          />
          {memberSince && (
            <SettingsRow
              icon={<Calendar size={17} />}
              label="Member since"
              value={memberSince}
              noBorder
            />
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            LINKED ACCOUNTS
        ══════════════════════════════════════════════════════ */}
        <SectionLabel label="Linked Accounts" />
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            margin: "0 16px",
            border: "1px solid var(--glass-border)",
            overflow: "hidden",
          }}
        >
          {/* DK Bank */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: hasDKBank
                    ? "rgba(16,185,129,0.12)"
                    : "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Building2
                  size={17}
                  color={hasDKBank ? "#10b981" : "var(--text-muted)"}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-main)",
                  }}
                >
                  DK Bank
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: hasDKBank ? "#10b981" : "var(--text-subtle)",
                    marginTop: 1,
                  }}
                >
                  {hasDKBank
                    ? currentUser?.dkAccountName
                      ? `Linked · ${currentUser.dkAccountName}`
                      : "Linked"
                    : "Not linked — required for deposits"}
                </div>
              </div>
              {hasDKBank ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <XCircle size={18} color="#ef4444" />
              )}
            </div>

            {/* Link form — only shown when not linked */}
            {!hasDKBank && linkStep !== "success" && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter 11-digit CID"
                    value={cidInput}
                    onChange={(e) => {
                      setCidInput(e.target.value.slice(0, 11));
                      if (linkStep === "error") setLinkStep("idle");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${linkStep === "error" ? "#ef4444" : "var(--glass-border)"}`,
                      background: "var(--bg-secondary)",
                      color: "var(--text-main)",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleLinkDKBank}
                    disabled={linkStep === "loading" || cidInput.length !== 11}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background:
                        cidInput.length === 11
                          ? "#2563eb"
                          : "var(--bg-secondary)",
                      color:
                        cidInput.length === 11 ? "#fff" : "var(--text-subtle)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor:
                        cidInput.length === 11 ? "pointer" : "not-allowed",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {linkStep === "loading" ? (
                      <Loader2
                        size={14}
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />
                    ) : (
                      <Link2 size={14} />
                    )}
                    Link
                  </button>
                </div>
                {linkStep === "error" && (
                  <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>
                    {linkError}
                  </div>
                )}
              </div>
            )}
            {linkStep === "success" && !hasDKBank && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#4ade80",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={13} /> DK Bank linked successfully!
              </div>
            )}
          </div>

          {/* Telegram Phone */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: hasPhone
                    ? "rgba(16,185,129,0.12)"
                    : "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Smartphone
                  size={17}
                  color={hasPhone ? "#10b981" : "var(--text-muted)"}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-main)",
                  }}
                >
                  Telegram Phone
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: hasPhone ? "#10b981" : "var(--text-subtle)",
                    marginTop: 1,
                  }}
                >
                  {hasPhone
                    ? "Verified"
                    : "Not verified — share via Telegram bot"}
                </div>
              </div>
              {hasPhone ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <XCircle size={18} color="#94a3b8" />
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            ABOUT / SUPPORT
        ══════════════════════════════════════════════════════ */}
        <SectionLabel label="About & Support" />
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 16,
            margin: "0 16px",
            border: "1px solid var(--glass-border)",
            overflow: "hidden",
          }}
        >
          <SettingsRow
            icon={<MessageCircle size={17} />}
            label="Support"
            value="Chat with us on Telegram"
            onClick={() => {
              const url = `https://t.me/${BOT_USERNAME}`;
              if (window.Telegram?.WebApp?.openTelegramLink) {
                window.Telegram.WebApp.openTelegramLink(url);
              } else {
                window.open(url, "_blank");
              }
            }}
          >
            <ExternalLink size={15} color="var(--text-subtle)" />
          </SettingsRow>

          <SettingsRow
            icon={<Info size={17} />}
            label="App version"
            value="1.0.0"
            noBorder
          />
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        `}</style>
      </div>
    </Page>
  );
};
