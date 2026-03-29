import ReactDOM from "react-dom/client";
import { StrictMode } from "react";

import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

/**
 * Detect whether we're running inside a real Telegram client.
 * Check multiple indicators:
 * - TelegramGameProxy (older method)
 * - TelegramWebviewProxy (desktop/macOS Telegram)
 * - Telegram.WebApp object with actual initData
 * - Any tgWebApp* params in the URL (search or hash)
 */
const urlParams = window.location.search + window.location.hash;
const isInsideTelegram =
  !!(window as any).TelegramGameProxy ||
  !!(window as any).TelegramWebviewProxy ||
  !!(window as any).Telegram?.WebApp?.initData ||
  /tgWebApp/i.test(urlParams);

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
