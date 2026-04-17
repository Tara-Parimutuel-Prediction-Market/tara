import { HashRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { PwaFeedPage } from "./pages/PwaFeedPage";
import { PwaMarketDetailPage } from "./pages/PwaMarketDetailPage";
import { PwaPaymentTestPage } from "./pages/PwaPaymentTestPage";
import { PwaMyBetsPage } from "./pages/PwaMyBetsPage";
import { PwaResultsPage } from "./pages/PwaResultsPage";
import { PwaBottomNav } from "./components/PwaBottomNav";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Mark as PWA mode so TMA-specific SDK calls (backButton etc.) are skipped
if (typeof window !== "undefined") {
  (window as any).__PWA_MODE__ = true;
}

// Lazy-load the heavier TMA pages — they only need the JWT token to work in PWA
const PwaLeaderboardPage = lazy(() =>
  import("@/tma/pages/TmaLeaderboardPage").then((m) => ({
    default: m.TmaLeaderboardPage,
  })),
);
const PwaChallengesPage = lazy(() =>
  import("@/tma/pages/TmaChallengesPage").then((m) => ({
    default: m.TmaChallengesPage,
  })),
);
const PwaProfilePage = lazy(() =>
  import("@/tma/pages/TmaProfilePage").then((m) => ({
    default: m.TmaProfilePage,
  })),
);
const PwaSettingsPage = lazy(() =>
  import("@/tma/pages/TmaSettingsPage").then((m) => ({
    default: m.TmaSettingsPage,
  })),
);
const PwaResolvedPage = lazy(() =>
  import("@/tma/pages/ResolvedMarketsPage").then((m) => ({
    default: m.ResolvedMarketsPage,
  })),
);
const PwaWalletTmaPage = lazy(() =>
  import("@/tma/pages/TmaWalletPage").then((m) => ({
    default: m.TmaWalletPage,
  })),
);

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { publicUrl } from "@/helpers/publicUrl.ts";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OroLogo } from "@/components/OroLogo";
import { FilterProvider, useFilter } from "@/contexts/FilterContext";
import {
  Search,
  ChevronDown,
  CircleHelp,
  LayoutGrid,
  Medal,
  Wallet,
  Swords,
  UserCircle,
  Menu,
  X as XIcon,
  LogOut,
} from "lucide-react";
import { HowItWorksModal } from "./components/HowItWorksModal";
import { isTokenValid, clearToken } from "@/api/client";

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/", label: "Feed", icon: LayoutGrid },
  { to: "/leaderboard", label: "Ranks", icon: Medal },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/challenges", label: "Duels", icon: Swords },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

// ── Hamburger Menu (mobile: full-screen drawer · desktop: dropdown) ───────────

function HamburgerMenu({ isMobile }: { isMobile: boolean }) {
  const [open, setOpen] = useState(false);

  function handleLogout() {
    setOpen(false);
    clearToken();
    window.dispatchEvent(new Event("oro:unauthorized"));
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          background: open ? "var(--bg-card)" : "var(--bg-secondary)",
          border: "1px solid var(--glass-border)",
          color: "var(--text-main)",
          cursor: "pointer",
          flexShrink: 0,
        }}
        aria-label="Open menu"
      >
        {open ? <XIcon size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9990,
              background: isMobile ? "rgba(0,0,0,0.4)" : "transparent",
            }}
          />

          {/* Desktop dropdown */}
          {!isMobile ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                zIndex: 9991,
                minWidth: 220,
                background: "var(--bg-card)",
                border: "1px solid var(--glass-border)",
                borderRadius: 14,
                boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                overflow: "hidden",
                animation: "drawerIn 0.18s ease-out forwards",
              }}
            >
              <style>{`
                @keyframes drawerIn {
                  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                  to   { opacity: 1; transform: translateY(0) scale(1); }
                }
              `}</style>
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 18px",
                    textDecoration: "none",
                    color: isActive
                      ? "var(--color-primary)"
                      : "var(--text-main)",
                    background: isActive
                      ? "rgba(39,117,208,0.07)"
                      : "transparent",
                    fontSize: "0.9rem",
                    fontWeight: isActive ? 800 : 600,
                    borderLeft: isActive
                      ? "3px solid var(--color-primary)"
                      : "3px solid transparent",
                    transition: "background 0.12s",
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2.5 : 2}
                        color={
                          isActive
                            ? "var(--color-primary)"
                            : "var(--text-muted)"
                        }
                      />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
              <div
                style={{
                  margin: "6px 16px",
                  borderTop: "1px solid var(--glass-border)",
                }}
              />
              <a
                href="https://t.me/OroPredictBot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 18px",
                  textDecoration: "none",
                  color: "#fff",
                  background: "var(--grad-primary)",
                  margin: "0 12px 8px",
                  borderRadius: 10,
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  boxShadow: "0 4px 12px rgba(39,117,208,0.3)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Open in Telegram
              </a>
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "calc(100% - 24px)",
                  margin: "0 12px 12px",
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.06)",
                  color: "#ef4444",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          ) : (
            /* Mobile drawer — only actions (nav is in bottom bar) */
            <div
              style={{
                position: "fixed",
                top: 60,
                left: 0,
                right: 0,
                zIndex: 9991,
                background: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                borderBottom: "1px solid var(--glass-border)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                padding: "16px 16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                animation: "drawerIn 0.2s ease-out forwards",
              }}
            >
              <a
                href="https://t.me/OroPredictBot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "14px",
                  textDecoration: "none",
                  color: "#fff",
                  background: "var(--grad-primary)",
                  borderRadius: 14,
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  boxShadow: "0 4px 16px rgba(39,117,208,0.35)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Open in Telegram
              </a>
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  padding: "14px",
                  borderRadius: 14,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.06)",
                  color: "#ef4444",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Polymarket-style Search ───────────────────────────────────────────────────

function PwaSearch({ compact = false, fullWidth = false }: { compact?: boolean, fullWidth?: boolean }) {
  const { searchQuery, setSearchQuery } = useFilter();
  const [isFocused, setIsFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Compact (mobile): icon-only that expands on click
  if (compact) {
    return (
      <div style={{ position: "relative" }}>
        {expanded ? (
          <>
            <div
              onClick={() => {
                setExpanded(false);
                setSearchQuery("");
              }}
              style={{ position: "fixed", inset: 0, zIndex: 9990 }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 9991,
                width: 260,
                background: "var(--bg-card)",
                border: "1.5px solid var(--color-primary)",
                borderRadius: 24,
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                boxShadow: "0 8px 24px -4px rgba(39,117,208,0.25)",
              }}
            >
              <Search
                size={15}
                color="var(--color-primary)"
                style={{ flexShrink: 0 }}
              />
              <input
                autoFocus
                type="text"
                placeholder="Search markets…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "10px 10px",
                  color: "var(--text-main)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              />
            </div>
          </>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <Search size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      style={fullWidth ? { position: "relative", width: "100%" } : { 
        position: "relative", 
        width: isFocused ? 260 : 200, 
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
      }}
    >
      <Search
        size={15}
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: isFocused ? "var(--color-primary)" : "var(--text-subtle)",
          transition: "color 0.2s",
          pointerEvents: "none",
        }}
      />
      <input
        type="text"
        placeholder={fullWidth ? "Search markets..." : "Search markets…"}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: isFocused ? "var(--bg-card)" : "var(--bg-secondary)",
          border: isFocused
            ? "1.5px solid var(--color-primary)"
            : "1px solid var(--glass-border)",
          borderRadius: fullWidth ? 8 : 22,
          padding: fullWidth ? "12px 16px 12px 38px" : "9px 16px 9px 38px",
          color: "var(--text-main)",
          fontSize: fullWidth ? "0.95rem" : "0.85rem",
          fontWeight: 600,
          outline: "none",
          transition: "all 0.2s ease",
          boxShadow: isFocused
            ? "0 6px 16px -4px rgba(39,117,208,0.2)"
            : "none",
        }}
      />
      {fullWidth && (
        <div
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--bg-card)",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 4,
            pointerEvents: "none",
            border: "1px solid var(--glass-border)",
          }}
        >
          /
        </div>
      )}
    </div>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────

function PwaLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { selectedCategory, setSelectedCategory, availableCategories, hasTrendingMarkets } =
    useFilter();

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

      {/* ── Top bar (Polymarket-style Two-tier) ── */}
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--glass-border)",
          position: "sticky",
          top: 0,
          zIndex: 3000,
        }}
      >
        {/* ROW 1: Logo, Search, Actions */}
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 var(--space-md)",
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Left: Logo */}
          <NavLink
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <OroLogo size={62} />
            <span
              style={{
                fontWeight: 600,
                fontSize: "1.8rem",
                color: "var(--text-main)",
                letterSpacing: "-0.03em",
                fontFamily: "uppercase",
              }}
            >
              Oro
            </span>
          </NavLink>

          {/* Spacer on mobile */}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Middle: Giant Search (Desktop) */}
          {!isMobile && (
            <div style={{ flex: 1, maxWidth: 640 }}>
              <PwaSearch fullWidth />
            </div>
          )}

          {/* Spacer to push actions to right on desktop */}
          {!isMobile && <div style={{ flex: 1 }} />}

          {/* Right actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexShrink: 0,
            }}
          >
            {!isMobile && (
              <button
                onClick={() => setShowHowItWorks(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <CircleHelp size={14} /> How it works
              </button>
            )}

            <HamburgerMenu isMobile={isMobile} />
          </div>
        </div>

        {/* ROW 2: Sub-Nav — desktop text links / mobile search + category pills */}
        <div style={{ borderTop: "1px solid var(--glass-border)" }}>
          {isMobile ? (
            /* ── Mobile: search bar + category pills ── */
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Search bar */}
              <PwaSearch fullWidth />

              {/* Category pills — only when categories exist */}
              {availableCategories.length > 1 && (
                <div style={{
                  display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2,
                  scrollbarWidth: "none", msOverflowStyle: "none",
                }}
                  className="hide-scrollbar"
                >
                  <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
                  {availableCategories.map((cat) => {
                    const isActive = selectedCategory === cat;
                    return (
                      <NavLink
                        key={cat}
                        to="/"
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                          flexShrink: 0,
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          border: isActive ? "1.5px solid var(--color-primary)" : "1px solid var(--glass-border)",
                          background: isActive ? "rgba(39,117,208,0.12)" : "var(--glass-bg)",
                          color: isActive ? "var(--color-primary)" : "var(--text-muted)",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                          transition: "all 0.15s",
                        }}
                      >
                        {cat}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Desktop: text links ── */
            <div
              style={{
                maxWidth: 1240,
                margin: "0 auto",
                padding: "0 var(--space-md)",
                height: 48,
                display: "flex",
                alignItems: "center",
                gap: 24,
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {hasTrendingMarkets && (
                <NavLink
                  to="/"
                  onClick={() => setSelectedCategory("All")}
                  style={({ isActive }) => ({
                    display: "flex", alignItems: "center", gap: 6,
                    textDecoration: "none", fontSize: "0.88rem",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? "var(--text-main)" : "var(--text-muted)",
                  })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  Trending
                </NavLink>
              )}

              {availableCategories.filter((cat) => cat !== "All").length > 0 && (
                <>
                  <div style={{ width: 1, height: 16, background: "var(--glass-border)", margin: "0 -8px" }} />
                  {availableCategories.filter((cat) => cat !== "All").map((cat) => (
                    <NavLink
                      key={cat}
                      to="/"
                      onClick={() => setSelectedCategory(cat)}
                      style={({ isActive }) => ({
                        textDecoration: "none", fontSize: "0.88rem",
                        fontWeight: isActive && selectedCategory === cat ? 800 : 600,
                        color: isActive && selectedCategory === cat ? "var(--text-main)" : "var(--text-muted)",
                        cursor: "pointer",
                      })}
                    >
                      {cat}
                    </NavLink>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div style={{ paddingBottom: isMobile ? 80 : 20 }}>
        <Routes>
          <Route path="/" element={<PwaFeedPage />} />
          <Route path="/markets" element={<Navigate to="/" />} />
          <Route path="/market/:id" element={<PwaMarketDetailPage />} />
          <Route path="/payment-test" element={<PwaPaymentTestPage />} />
          <Route
            path="/wallet"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PwaWalletTmaPage />
              </Suspense>
            }
          />
          <Route path="/my-bets" element={<PwaMyBetsPage />} />
          <Route path="/results" element={<PwaResultsPage />} />
          <Route
            path="/leaderboard"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PwaLeaderboardPage />
              </Suspense>
            }
          />
          <Route
            path="/challenges"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PwaChallengesPage />
              </Suspense>
            }
          />
          <Route
            path="/profile"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PwaProfilePage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PwaSettingsPage />
              </Suspense>
            }
          />
          <Route
            path="/resolved"
            element={
              <Suspense
                fallback={
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PwaResolvedPage />
              </Suspense>
            }
          />
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
  const [authed, setAuthed] = useState(() => isTokenValid());
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  // Listen for 401s from the API client — force back to login
  useEffect(() => {
    const handler = () => {
      clearToken();
      setAuthed(false);
    };
    window.addEventListener("oro:unauthorized", handler);
    return () => window.removeEventListener("oro:unauthorized", handler);
  }, []);

  if (!authed) {
    return (
      <ThemeProvider>
        <div
          style={{
            minHeight: "100vh",
            background: "var(--bg-main)",
            color: "var(--text-main)",
          }}
        >
          <div className="mesh-bg" />
          <ProtectedRoute onLogin={() => setAuthed(true)} />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppRoot appearance={isDark ? "dark" : "light"} platform="base">
        <TonConnectUIProvider
          manifestUrl={publicUrl("tonconnect-manifest.json")}
        >
          <FilterProvider>
            <HashRouter>
              <PwaLayout />
            </HashRouter>
          </FilterProvider>
        </TonConnectUIProvider>
      </AppRoot>
    </ThemeProvider>
  );
}
