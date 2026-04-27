import { useState, useEffect, useRef } from "react";
import { loginWithDKBank, getPwaStatus, setToken } from "@/api/client";
import { Eye, EyeOff } from "lucide-react";
import { OroLogo } from "@/components/OroLogo";

interface Props {
  onLogin: () => void;
  children?: React.ReactNode;
}

export function ProtectedRoute({ onLogin }: Props) {
  const [cid, setCid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null); // null = not checked yet
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When CID reaches 11 digits, check if this account has a PWA password set
  useEffect(() => {
    if (cid.trim().length !== 11) {
      setHasPassword(null);
      setPassword("");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const { hasPassword: hp } = await getPwaStatus(cid.trim());
        setHasPassword(hp);
      } catch {
        setHasPassword(false);
      } finally {
        setChecking(false);
      }
    }, 500);
  }, [cid]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithDKBank(
        cid.trim(),
        hasPassword ? password : undefined,
      );
      setToken(res.token);
      onLogin();
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    cid.trim().length === 11 &&
    !checking &&
    hasPassword === true &&
    password.length >= 1;

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "80px auto",
        padding: "0 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}>
          <OroLogo size={90} />
        </div>
        <h2
          style={{
            fontSize: "1.3rem",
            fontWeight: 800,
            color: "var(--text-main)",
            margin: 0,
          }}
        >
          Sign in to Oro
        </h2>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Enter your DK Bank CID to access your account
        </p>
      </div>

      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        {/* CID field */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--text-subtle)",
            }}
          >
            DK Bank CID
          </label>
          <input
            type="text"
            value={cid}
            onChange={(e) => {
              setCid(e.target.value.replace(/\D/g, "").slice(0, 11));
              setError(null);
            }}
            placeholder="11-digit CID"
            maxLength={11}
            required
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--glass-border)",
              background: "var(--glass-bg)",
              color: "var(--text-main)",
              fontSize: "1rem",
              outline: "none",
            }}
          />
          {checking && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
              Checking account…
            </div>
          )}
        </div>

        {/* Password field — only shown when account has a password set */}
        {hasPassword && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-subtle)",
              }}
            >
              PWA Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Enter your password"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--glass-border)",
                  background: "var(--glass-bg)",
                  color: "var(--text-main)",
                  fontSize: "1rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-subtle)",
                  display: "flex",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              Password set via Telegram → Settings → Website Access
            </div>
          </div>
        )}

        {/* Block login when no password has been set yet */}
        {hasPassword === false && cid.trim().length === 11 && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--color-warning)",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.25)",
              borderRadius: 10,
              padding: "12px 14px",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>Password required</strong>
            Open Telegram → Oro app → <strong>Settings → PWA Access</strong> and set a password before logging in here.
          </div>
        )}

        {error && (
          <div style={{ fontSize: "0.8rem", color: "#ef4444" }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{
            padding: "11px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: canSubmit && !loading ? "pointer" : "not-allowed",
            opacity: canSubmit && !loading ? 1 : 0.5,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
