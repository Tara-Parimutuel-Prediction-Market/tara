import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { PwaFeedPage } from "./pages/PwaFeedPage";
import { PwaMarketsPage } from "./pages/PwaMarketsPage";
import { PwaMarketDetailPage } from "./pages/PwaMarketDetailPage";
import { PwaPaymentTestPage } from "./pages/PwaPaymentTestPage";
import { AdminPage } from "./pages/AdminPage";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { publicUrl } from "@/helpers/publicUrl.ts";

function PwaLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <Routes>
        <Route path="/admin/*" element={<AdminPage />} />
      </Routes>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f7",
        color: "#111827",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #f0f0f0",
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center" }}>
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* T icon mark */}
          <svg width="36" height="36" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            {/* Green dot */}
            <circle cx="10" cy="36" r="6" fill="#3ecf6e"/>
            {/* Blue dot */}
            <circle cx="20" cy="52" r="5" fill="#2b7fdb"/>
            {/* Green curved left cap of crossbar */}
            <path d="M28,18 C28,10 34,6 42,6 L56,6 L56,22 L42,22 C36,22 28,26 28,18 Z" fill="#3ecf6e"/>
            {/* Blue right crossbar */}
            <rect x="56" y="6" width="18" height="16" rx="8" fill="#2775d0"/>
            {/* Vertical stripe left */}
            <rect x="56" y="22" width="8" height="50" rx="3" fill="#1c5bb8"/>
            {/* Vertical stripe middle */}
            <rect x="67" y="22" width="8" height="50" rx="3" fill="#2775d0"/>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800, fontSize: "1rem", color: "#111827", letterSpacing: "-0.02em" }}>
              Tara
            </span>
            <span style={{ fontSize: "0.6rem", color: "#9ca3af", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Parimutuel Predictions
            </span>
          </div>
        </div>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="https://t.me/Tara_parimutuel_bot"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "linear-gradient(135deg, #229ed9, #1a7abf)",
              color: "#fff",
              padding: "7px 14px",
              borderRadius: 20,
              textDecoration: "none",
              fontSize: "0.75rem",
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(34,158,217,0.3)",
              letterSpacing: "0.01em",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Telegram
          </a>
        </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<PwaFeedPage />} />
        <Route path="/markets" element={<PwaMarketsPage />} />
        <Route path="/market/:id" element={<PwaMarketDetailPage />} />
        <Route path="/payment-test" element={<PwaPaymentTestPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export function PwaApp() {
  return (
    <TonConnectUIProvider manifestUrl={publicUrl("tonconnect-manifest.json")}>
      <HashRouter>
        <PwaLayout />
      </HashRouter>
    </TonConnectUIProvider>
  );
}
