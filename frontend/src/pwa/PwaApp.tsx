import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { PwaFeedPage } from "./pages/PwaFeedPage";
import { PwaMarketsPage } from "./pages/PwaMarketsPage";
import { PwaMarketDetailPage } from "./pages/PwaMarketDetailPage";
import { PwaPaymentTestPage } from "./pages/PwaPaymentTestPage";
import { PwaBottomNav } from "./components/PwaBottomNav";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { publicUrl } from "@/helpers/publicUrl.ts";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OroLogo } from "@/components/OroLogo";
import { FilterProvider, useFilter } from "@/contexts/FilterContext";
import { Search, ChevronDown, CircleHelp } from "lucide-react";
import { HowItWorksModal } from "./components/HowItWorksModal";

// ── Navbar Controls ──────────────────────────────────────────────────────────

function NavbarControls({ isMobile, onShowHowItWorks }: { isMobile: boolean, onShowHowItWorks: () => void }) {
  const {
    selectedCategory,
    setSelectedCategory,
    availableCategories,
  } = useFilter();

  if (isMobile) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 16,
        flex: 1,
      }}
    >
      <button
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          fontWeight: 700,
          cursor: "pointer",
          padding: "8px 0",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-main)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        onClick={onShowHowItWorks}
      >
        <CircleHelp size={16} />
        How it works
      </button>

      <div style={{ position: "relative" }}>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            appearance: "none",
            background: "var(--bg-card)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            padding: "8px 36px 8px 14px",
            color: "var(--text-main)",
            fontSize: "0.85rem",
            fontWeight: 700,
            outline: "none",
            cursor: "pointer",
            minWidth: 120,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
      </div>

      <a
        href="https://t.me/OroPredictBot"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "linear-gradient(135deg, #229ed9, #1a7abf)",
          color: "#fff",
          padding: "7px 14px",
          borderRadius: 20,
          textDecoration: "none",
          fontSize: "0.75rem",
          fontWeight: 700,
          boxShadow: "0 2px 8px rgba(34,158,217,0.3)",
          letterSpacing: "0.01em",
          flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
        Telegram
      </a>
    </div>
  );
}

// ── Search Component ─────────────────────────────────────────────────────────

function PwaSearch() {
  const { searchQuery, setSearchQuery } = useFilter();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        flex: 2,
        maxWidth: 500,
        margin: "0 auto",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isFocused ? "scale(1.02)" : "scale(1)",
      }}
    >
      <Search
        size={18}
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          color: isFocused ? "var(--text-main)" : "var(--text-subtle)",
          transition: "color 0.3s",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <input
        type="text"
        placeholder="Search for markets, teams, or assets..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: "100%",
          background: isFocused ? "rgba(255,255,255,0.06)" : "var(--bg-card)",
          border: "1px solid var(--glass-border)",
          borderRadius: 24,
          padding: "12px 20px 12px 48px",
          color: "var(--text-main)",
          fontSize: "0.9rem",
          fontWeight: 600,
          outline: "none",
          transition: "all 0.3s",
          boxShadow: isFocused 
            ? "0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px #3b82f640" 
            : "var(--shadow-sm)",
          backdropFilter: "blur(12px)",
        }}
      />
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────

function PwaLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

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
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 16px",
            height: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          {/* Section 1: Branding (Flex 1) */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
            <OroLogo size={54} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontWeight: 900, fontSize: "1.3rem", color: "var(--text-main)", letterSpacing: "-0.03em", fontFamily: "var(--font-display)" }}>
                Oro
              </span>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Pramimutuel Predictions
              </span>
            </div>
          </div>

          {/* Section 2: Search (Flex 2, Centered) */}
          {!isMobile && <PwaSearch />}

          {/* Section 3: Controls (Flex 1, Right Aligned) */}
          <NavbarControls isMobile={isMobile} onShowHowItWorks={() => setShowHowItWorks(true)} />
        </div>
      </header>

      <div style={{ paddingBottom: isMobile ? 80 : 20 }}>
        <Routes>
          <Route path="/" element={<PwaFeedPage />} />
          <Route path="/markets" element={<PwaMarketsPage />} />
          <Route path="/market/:id" element={<PwaMarketDetailPage />} />
          <Route path="/payment-test" element={<PwaPaymentTestPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      <PwaBottomNav />
      
      <HowItWorksModal 
        isOpen={showHowItWorks} 
        onClose={() => setShowHowItWorks(false)} 
      />
    </div>
  );
}

// ── App Root ─────────────────────────────────────────────────────────────────

export function PwaApp() {
  return (
    <ThemeProvider>
      <TonConnectUIProvider manifestUrl={publicUrl("tonconnect-manifest.json")}>
        <FilterProvider>
          <HashRouter>
            <PwaLayout />
          </HashRouter>
        </FilterProvider>
      </TonConnectUIProvider>
    </ThemeProvider>
  );
}
