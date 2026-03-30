import { mockTelegramEnv, emitEvent } from "@tma.js/sdk-react";

const isDevelopment =
  import.meta.env.DEV || import.meta.env.MODE === "development";
const forceDevMode =
  new URLSearchParams(window.location.search).get("dev") === "true";

// Only mock if NOT inside a real Telegram WebApp.
// Must match the same detection used in index.tsx — real TMA clients expose
// TelegramWebviewProxy or window.Telegram.WebApp, NOT TelegramGameProxy
// (that's only for Telegram Games, a separate feature).
const urlParams = typeof window !== "undefined"
  ? window.location.search + window.location.hash
  : "";
const isRealTelegram =
  typeof window !== "undefined" && (
    !!(window as any).TelegramGameProxy ||
    !!(window as any).TelegramWebviewProxy ||
    !!(window as any).Telegram?.WebApp?.initData ||
    /tgWebApp/i.test(urlParams)
  );

if (!isRealTelegram && (isDevelopment || forceDevMode)) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Synchronously fetch a properly signed initData from our backend dev endpoint
  let validInitData = "";
  try {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "GET",
      `${API_URL}/auth/dev/mock-init-data?id=999999999&first_name=DevUser&username=devuser`,
      false,
    );
    xhr.send();
    if (xhr.status === 200) {
      validInitData = JSON.parse(xhr.responseText).initData;
      console.info("✅ mockEnv: fetched valid initData from backend");
    }
  } catch (e) {
    console.warn("⚠️ mockEnv: could not fetch initData:", e);
  }

  const themeParams = {
    accent_text_color: "#6ab2f2" as const,
    bg_color: "#17212b" as const,
    button_color: "#5288c1" as const,
    button_text_color: "#ffffff" as const,
    destructive_text_color: "#ec3942" as const,
    header_bg_color: "#17212b" as const,
    hint_color: "#708499" as const,
    link_color: "#6ab3f3" as const,
    secondary_bg_color: "#232e3c" as const,
    section_bg_color: "#17212b" as const,
    section_header_text_color: "#6ab3f3" as const,
    subtitle_text_color: "#708499" as const,
    text_color: "#f5f5f5" as const,
  };

  const noInsets = { left: 0, top: 0, bottom: 0, right: 0 } as const;

  mockTelegramEnv({
    launchParams: {
      tgWebAppData: validInitData
        ? new URLSearchParams(validInitData)
        : undefined,
      tgWebAppThemeParams: themeParams,
      tgWebAppVersion: "7.0",
      tgWebAppPlatform: "tdesktop",
    },
    onEvent(e, next) {
      if (e.name === "web_app_request_theme") {
        return emitEvent("theme_changed", { theme_params: themeParams });
      }
      if (e.name === "web_app_request_viewport") {
        return emitEvent("viewport_changed", {
          height: window.innerHeight,
          width: window.innerWidth,
          is_expanded: true,
          is_state_stable: true,
        });
      }
      if (e.name === "web_app_request_content_safe_area") {
        return emitEvent("content_safe_area_changed", noInsets);
      }
      if (e.name === "web_app_request_safe_area") {
        return emitEvent("safe_area_changed", noInsets);
      }
      next();
    },
  });

  console.info("⚠️ Running outside Telegram — mocked environment active.");
}
