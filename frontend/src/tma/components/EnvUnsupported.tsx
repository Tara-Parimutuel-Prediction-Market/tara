import { Placeholder, AppRoot } from "@telegram-apps/telegram-ui";
import { retrieveLaunchParams, isColorDark, isRGB } from "@tma.js/sdk-react";
import { useMemo } from "react";

export function EnvUnsupported() {
  const [platform, isDark] = useMemo(() => {
    try {
      const lp = retrieveLaunchParams();
      const { bg_color: bgColor } = lp.tgWebAppThemeParams;
      return [
        lp.tgWebAppPlatform,
        bgColor && isRGB(bgColor) ? isColorDark(bgColor) : false,
      ];
    } catch {
      return ["android", false];
    }
  }, []);

  return (
    <AppRoot
      appearance={isDark ? "dark" : "light"}
      platform={["macos", "ios"].includes(platform) ? "ios" : "base"}
    >
      <Placeholder
        header="Tara - Parmutuel Betting"
        description="This app is only available through Telegram. Please open it in the Telegram app."
      >
        <img
          alt="Telegram logo"
          src="https://xelene.me/telegram.gif"
          style={{
            display: "block",
            width: "144px",
            height: "144px",
            margin: "0 auto",
          }}
        />
        <div style={{ marginTop: "2rem", padding: "0 1rem" }}>
          <p style={{ fontSize: "0.9rem", lineHeight: "1.5", color: "#888" }}>
            To access Tara betting platform:
          </p>
          <ol
            style={{
              textAlign: "left",
              fontSize: "0.9rem",
              lineHeight: "1.8",
              color: "#888",
              marginTop: "1rem",
            }}
          >
            <li>Open Telegram on your device</li>
            <li>
              Search for <strong>@Tara_parimutuel_bot</strong>
            </li>
            <li>Start the bot and tap "Open App"</li>
          </ol>
        </div>
      </Placeholder>
    </AppRoot>
  );
}
