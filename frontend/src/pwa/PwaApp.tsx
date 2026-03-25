import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { PwaMarketsPage } from "./pages/PwaMarketsPage";
import { PwaMarketDetailPage } from "./pages/PwaMarketDetailPage";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { publicUrl } from "@/helpers/publicUrl.ts";

export function PwaApp() {
  return (
    <TonConnectUIProvider manifestUrl={publicUrl("tonconnect-manifest.json")}>
      <div
        style={{
          minHeight: "100vh",
          background: "#0f1923",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <header
          style={{
            background: "#17212b",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderBottom: "1px solid #2a3a4a",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: "1.4rem" }}></span>
          <span
            style={{ fontWeight: 700, fontSize: "1.1rem", color: "#6ab3f3" }}
          >
            Tara
          </span>
          <span
            style={{ fontSize: "0.75rem", color: "#708499", marginLeft: "4px" }}
          >
            Prediction Platform
          </span>
          <div style={{ marginLeft: "auto" }}>
            <a
              href="https://t.me/Tara_parimutuel_bot"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#229ed9",
                color: "#fff",
                padding: "6px 14px",
                borderRadius: "20px",
                textDecoration: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Open in Telegram
            </a>
          </div>
        </header>

        <HashRouter>
          <Routes>
            <Route path="/" element={<PwaMarketsPage />} />
            <Route path="/market/:id" element={<PwaMarketDetailPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </div>
    </TonConnectUIProvider>
  );
}
