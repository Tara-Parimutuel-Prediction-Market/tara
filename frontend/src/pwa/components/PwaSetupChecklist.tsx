import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from "lucide-react";
import { getMe, type AuthUser } from "@/api/client";

const DISMISSED_KEY = "oro_setup_dismissed";

interface Step {
  id: string;
  label: string;
  detail: string;
  done: (u: AuthUser) => boolean;
  action: string;
  to: string;
}

const STEPS: Step[] = [
  {
    id: "wallet",
    label: "Link your DK Bank account",
    detail: "Connect your DK Bank CID to deposit and withdraw funds.",
    done: (u) => !!u.dkCid,
    action: "Go to Wallet",
    to: "/wallet",
  },
  {
    id: "deposit",
    label: "Add funds to your balance",
    detail: "Deposit Nu to start predicting on live markets.",
    done: (u) => (u.creditsBalance ?? 0) > 0,
    action: "Deposit now",
    to: "/wallet",
  },
  {
    id: "predict",
    label: "Make your first prediction",
    detail: "Pick an outcome on any open market and place your stake.",
    done: (u) => (u.totalPredictions ?? 0) > 0,
    action: "Browse markets",
    to: "/",
  },
];

export function PwaSetupChecklist() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(DISMISSED_KEY)
  );
  const navigate = useNavigate();

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {});
  }, []);

  if (dismissed || !user) return null;

  const steps = STEPS.map((s) => ({ ...s, isDone: s.done(user) }));
  const doneCount = steps.filter((s) => s.isDone).length;
  const allDone = doneCount === steps.length;

  // Auto-dismiss once everything is complete
  if (allDone) {
    localStorage.setItem(DISMISSED_KEY, "1");
    return null;
  }

  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        padding: collapsed ? "14px 16px" : "16px 16px 20px",
        marginBottom: "var(--space-xl)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Progress bar accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 3,
          width: `${progress}%`,
          background: "var(--grad-primary)",
          borderRadius: "3px 3px 0 0",
          transition: "width 0.4s ease",
        }}
      />

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 900,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-primary)",
              background: "rgba(39,117,208,0.1)",
              padding: "3px 8px",
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            Setup
          </div>
          <span
            style={{
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "var(--text-main)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {doneCount}/{steps.length} steps complete
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            onClick={() => {
              localStorage.setItem(DISMISSED_KEY, "1");
              setDismissed(true);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-subtle)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: s.isDone
                  ? "rgba(34,197,94,0.06)"
                  : "var(--bg-secondary)",
                border: s.isDone
                  ? "1px solid rgba(34,197,94,0.2)"
                  : "1px solid var(--glass-border)",
                transition: "background 0.2s",
              }}
            >
              {s.isDone ? (
                <CheckCircle2 size={18} color="var(--color-success)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
              ) : (
                <Circle size={18} color="var(--text-subtle)" strokeWidth={2} style={{ flexShrink: 0 }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: s.isDone ? "var(--text-muted)" : "var(--text-main)",
                    textDecoration: s.isDone ? "line-through" : "none",
                  }}
                >
                  {s.label}
                </div>
                {!s.isDone && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: 2, fontWeight: 500 }}>
                    {s.detail}
                  </div>
                )}
              </div>

              {!s.isDone && (
                <button
                  onClick={() => navigate(s.to)}
                  style={{
                    background: "var(--grad-primary)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "6px 12px",
                    cursor: "pointer",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.action}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
