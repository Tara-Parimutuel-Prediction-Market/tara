/**
 * PwaPage — drop-in replacement for TMA's <Page> component.
 * Renders children inside a scroll container with optional back button
 * (browser history, no Telegram SDK required).
 */
import { type PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export function PwaPage({
  children,
  back = false,
  title,
}: PropsWithChildren<{ back?: boolean; title?: string }>) {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {(back || title) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          {back && (
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                padding: 4,
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {title && (
            <span
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--text-main)",
              }}
            >
              {title}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
