import { useNavigate } from "react-router-dom";
import { backButton } from "@tma.js/sdk-react";
import { type PropsWithChildren, useEffect } from "react";

/** True when running outside the Telegram Mini App (e.g. PWA / browser). */
const isPwaMode = () =>
  typeof window !== "undefined" && (window as any).__PWA_MODE__ === true;

export function Page({
  children,
  back = true,
}: PropsWithChildren<{
  /**
   * True if it is allowed to go back from this page.
   */
  back?: boolean;
}>) {
  const navigate = useNavigate();

  useEffect(() => {
    // Skip TMA back-button API when running as PWA — it's not mounted.
    if (isPwaMode()) return;

    if (back) {
      backButton.show();
      return backButton.onClick(() => {
        navigate(-1);
      });
    }
    backButton.hide();
  }, [back]);

  return <>{children}</>;
}
