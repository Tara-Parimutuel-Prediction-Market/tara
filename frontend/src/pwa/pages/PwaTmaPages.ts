/**
 * PWA wrappers for TMA pages.
 * These re-export the TMA page components with a compatibility shim
 * so they work without the Telegram Mini App SDK.
 *
 * Strategy: monkey-patch the Page component import before the TMA page
 * renders by using module aliasing at the vite config level is complex,
 * so instead we wrap each page and provide the missing context.
 *
 * Since TmaLeaderboardPage, TmaChallengesPage, TmaProfilePage, TmaWalletPage
 * only use:
 *   - useAuth() from @/tma/hooks/useAuth  → calls getToken()/getMe() which work in PWA
 *   - <Page> from @/tma/components/Page   → uses TMA backButton (crashes in PWA)
 *
 * The TMA useAuth hook is safe in PWA — it just calls getMe() with the stored JWT.
 * The only crash is from <Page> using backButton.show().
 * We patch this by overriding window.__PWA_MODE__ = true so Page can guard itself.
 */

// Set flag before any TMA page mounts
if (typeof window !== "undefined") {
  (window as any).__PWA_MODE__ = true;
}

export { TmaLeaderboardPage as PwaLeaderboardPage } from "@/tma/pages/TmaLeaderboardPage";
export { TmaChallengesPage as PwaChallengesPage } from "@/tma/pages/TmaChallengesPage";
export { TmaProfilePage as PwaProfilePage } from "@/tma/pages/TmaProfilePage";
export { TmaWalletPage as PwaWalletPageFull } from "@/tma/pages/TmaWalletPage";
