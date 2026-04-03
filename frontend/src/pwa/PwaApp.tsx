import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PwaFeedPage } from "./pages/PwaFeedPage";
import { PwaMarketsPage } from "./pages/PwaMarketsPage";
import { PwaMarketDetailPage } from "./pages/PwaMarketDetailPage";
import { PwaPaymentTestPage } from "./pages/PwaPaymentTestPage";
// Disabled: betting is through Telegram only
// import { PwaMyBetsPage } from "./pages/PwaMyBetsPage";
// import { PwaWalletPage } from "./pages/PwaWalletPage";
// import { PwaResultsPage } from "./pages/PwaResultsPage";
// import { ProtectedRoute } from "./components/ProtectedRoute";
import { PwaBottomNav } from "./components/PwaBottomNav";
// import { useAuth } from "./hooks/useAuth";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { publicUrl } from "@/helpers/publicUrl.ts";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";

function PwaLayout() {
  // const { isAuthenticated, setIsAuthenticated } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        color: "var(--text-main)",
        fontFamily: "var(--font-primary)",
      }}
    >
      <div className="mesh-bg" />
      <header
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          borderBottom: "1px solid var(--glass-border)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 20px", height: 64, display: "flex", alignItems: "center" }}>
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* T icon mark */}
          <svg width="40" height="40" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="tara-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3ecf6e" />
                <stop offset="100%" stopColor="#2b7fdb" />
              </linearGradient>
            </defs>
            <circle cx="10" cy="36" r="6" fill="#3ecf6e"/>
            <circle cx="20" cy="52" r="5" fill="#2b7fdb"/>
            <path d="M28,18 C28,10 34,6 42,6 L56,6 L56,22 L42,22 C36,22 28,26 28,18 Z" fill="#3ecf6e"/>
            <rect x="56" y="6" width="18" height="16" rx="8" fill="#2775d0"/>
            <rect x="56" y="22" width="8" height="50" rx="3" fill="#1c5bb8"/>
            <rect x="67" y="22" width="8" height="50" rx="3" fill="#2775d0"/>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--text-main)", letterSpacing: "-0.03em", fontFamily: "var(--font-display)" }}>
              Tara
            </span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Parimutuel Predictions
            </span>
          </div>
        </div>

        {/* Top nav links - currently empty but reserved for future profile/global actions */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
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
          <ThemeToggle />
          
          {/* Desktop-only nav links — disabled: betting is through Telegram only */}
          {/* {!isMobile && [
            { to: "/my-bets", label: "My Bets" },
            { to: "/results", label: "Results" },
            { to: "/wallet", label: "Wallet" },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              padding: "6px 14px",
              borderRadius: 20,
              textDecoration: "none",
              fontSize: "0.78rem",
              fontWeight: 700,
              background: isActive ? "var(--accent, #2775d0)" : "var(--glass-bg)",
              color: isActive ? "#fff" : "var(--text-subtle)",
              border: "1px solid var(--glass-border)",
            })}>
              {label}
            </NavLink>
          ))} */}
        </div>

        </div>
      </header>

      <div style={{ paddingBottom: isMobile ? 80 : 20 }}>
        <Routes>
          <Route path="/" element={<PwaFeedPage />} />
          <Route path="/markets" element={<PwaMarketsPage />} />
          <Route path="/market/:id" element={<PwaMarketDetailPage />} />
          <Route path="/payment-test" element={<PwaPaymentTestPage />} />
          {/* Disabled: betting is through Telegram only */}
          {/* <Route path="/my-bets" element={
            isAuthenticated ? <PwaMyBetsPage /> : <ProtectedRoute onLogin={() => setIsAuthenticated(true)}>{null}</ProtectedRoute>
          } />
          <Route path="/wallet" element={
            isAuthenticated ? <PwaWalletPage /> : <ProtectedRoute onLogin={() => setIsAuthenticated(true)}>{null}</ProtectedRoute>
          } />
          <Route path="/results" element={
            isAuthenticated ? <PwaResultsPage /> : <ProtectedRoute onLogin={() => setIsAuthenticated(true)}>{null}</ProtectedRoute>
          } /> */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      <PwaBottomNav />

    </div>
  );
}

export function PwaApp() {
  return (
    <ThemeProvider>
      <TonConnectUIProvider manifestUrl={publicUrl("tonconnect-manifest.json")}>
        <HashRouter>
          <PwaLayout />
        </HashRouter>
      </TonConnectUIProvider>
    </ThemeProvider>
  );
}
