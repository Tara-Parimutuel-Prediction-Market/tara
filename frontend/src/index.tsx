import ReactDOM from "react-dom/client";
import { StrictMode } from "react";

import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

/**
 * Detect whether we're running inside a real Telegram client.
 * Check multiple indicators:
 * - TelegramGameProxy (older method)
 * - Telegram.WebApp object
 * - tgWebAppData in URL parameters
 */
const isInsideTelegram =
  !!(window as any).TelegramGameProxy ||
  !!(window as any).Telegram?.WebApp ||
  new URLSearchParams(window.location.search).has("tgWebAppData") ||
  window.location.hash.includes("tgWebAppData");

if (isInsideTelegram) {
  // ── TMA path ─────────────────────────────────────────────────────────────
  // Load Telegram UI styles and the full TMA SDK only when inside Telegram
  import("@telegram-apps/telegram-ui/dist/styles.css");
  import("@/tma/mockEnv.ts").then(() =>
    import("@/tma/init.ts").then(({ init }) =>
      init({
        debug: import.meta.env.DEV,
        eruda: false,
        mockForMacOS: false,
      }).then(() =>
        import("@/tma/components/Root.tsx").then(({ Root }) => {
          root.render(
            <StrictMode>
              <Root />
            </StrictMode>,
          );
        }),
      ),
    ),
  );
} else {
  // ── PWA path ─────────────────────────────────────────────────────────────
  // Plain React app — no TMA SDK, no Telegram auth required
  import("@/pwa/PwaApp.tsx").then(({ PwaApp }) => {
    root.render(
      <StrictMode>
        <PwaApp />
      </StrictMode>,
    );
  });
}
