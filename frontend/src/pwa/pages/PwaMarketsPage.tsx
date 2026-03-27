import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMarkets, Market } from "@/api/client";
import { useBreakpoint } from "../hooks/useBreakpoint";


const MarketCard = ({ market }: { market: Market }) => {
  const isUpcoming = market.status === "upcoming";

  return (
    <Link to={`/market/${market.id}`} style={{ textDecoration: "none", display: "flex", overflow: "visible" }}>
      <div
        style={{
          background: isUpcoming ? "linear-gradient(145deg, #1e2a38, #17212b)" : "#1c2633",
          border: isUpcoming ? "1px solid #5288c133" : "1px solid #2a3a4a66",
          borderRadius: "12px",
          padding: "12px",
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#5288c1";
          e.currentTarget.style.background = isUpcoming ? "linear-gradient(145deg, #233142, #1a2632)" : "#233142";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isUpcoming ? "#5288c133" : "#2a3a4a66";
          e.currentTarget.style.background = isUpcoming ? "linear-gradient(145deg, #1e2a38, #17212b)" : "#1c2633";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {isUpcoming && (
          <div style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "linear-gradient(90deg, #5288c1, #3a6ba0)",
            color: "#fff",
            padding: "2px 8px",
            fontSize: "0.55rem",
            fontWeight: 800,
            borderBottomLeftRadius: "8px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            zIndex: 2,
          }}>
            Soon
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: "0.9rem",
              color: "#f5f5f5",
              flex: 1,
              paddingRight: "8px",
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.4em",
            }}
          >
            {market.title}
          </span>
        </div>

        <div style={{ flex: 1, marginBottom: "12px" }}>
          {(() => {
            const totalPool = Number(market.totalPool);
            const withPct = market.outcomes.map((o) => ({
              ...o,
              pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
            }));
            const sorted = [...withPct].sort((a, b) => b.pct - a.pct);
            return withPct.slice(0, 2).map((o) => {
              const rank = sorted.findIndex((s) => s.id === o.id);
              const color = rank === 0 ? "#22c55e" : rank === sorted.length - 1 ? "#ef4444" : "#f59e0b";
              return (
                <div key={o.id} style={{ position: "relative", marginBottom: "6px", borderRadius: "6px", overflow: "hidden", background: "#232e3c" }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0,
                    width: isUpcoming ? "0%" : `${o.pct}%`,
                    background: isUpcoming ? "transparent" : `${color}33`,
                    transition: "width 0.5s ease-out",
                  }} />
                  <div style={{
                    position: "relative", display: "flex", justifyContent: "space-between",
                    padding: "6px 10px", fontSize: "0.75rem", fontWeight: 600, zIndex: 1,
                  }}>
                    <span style={{ color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{o.label}</span>
                    <span style={{ color: isUpcoming ? "#708499" : color }}>
                      {isUpcoming ? "Coming" : `${o.pct.toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
          {market.outcomes.length > 2 && (
            <div style={{ fontSize: "0.65rem", color: "#708499", textAlign: "right", marginTop: "2px" }}>
              +{market.outcomes.length - 2} more options
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "8px",
            paddingBottom: "10px",
            borderTop: "1px solid #2a3a4a33",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ color: "#708499", fontSize: "0.65rem" }}>VOL</span>
            <strong style={{ color: "#f5f5f5", fontSize: "0.7rem" }}>{market.totalPool}</strong>
          </div>

          {isUpcoming ? (
            <span style={{ color: "#FFC107", fontSize: "0.65rem", fontWeight: 600 }}>
              {new Date(market.opensAt!).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span style={{ color: "#708499", fontSize: "0.65rem" }}>
              Ends {new Date(market.closesAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
          <div
            style={{
              flex: 1,
              padding: "8px 10px",
              background: isUpcoming ? "#232e3c" : "#5288c1",
              color: "#fff",
              borderRadius: "8px",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "0.80rem",
              border: isUpcoming ? "1px solid #2a3a4a" : "none",
              transition: "all 0.2s",
            }}
          >
            {isUpcoming ? "View" : "Bet"}
          </div>

          {!isUpcoming && (
            <a
              href={`https://t.me/Tara_parimutuel_bot/app?startapp=market_${market.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#229ed9",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "0.80rem",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              App
            </a>
          )}
        </div>
      </div>
    </Link>
  );
};

function MarketGrid({ markets }: { markets: Market[] }) {
  const bp = useBreakpoint();
  const cols = bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(260px, 1fr))";
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: "16px", alignItems: "start" }}>
      {markets.map((m) => (
        <div
          key={m.id}
          style={{ position: "relative", zIndex: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.zIndex = "10")}
          onMouseLeave={(e) => (e.currentTarget.style.zIndex = "0")}
        >
          <MarketCard market={m} />
        </div>
      ))}
    </div>
  );
}

export function PwaMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMarkets()
      .then(setMarkets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <div style={{ textAlign: "center", color: "#708499" }}>
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
          <div>Loading markets...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#ec3942" }}>
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>❌</div>
        <div style={{ fontWeight: 600 }}>Failed to load markets</div>
        <div style={{ color: "#708499", marginTop: "8px", fontSize: "0.9rem" }}>{error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "20px",
            padding: "10px 24px",
            background: "#5288c1",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const openMarkets = markets.filter((m) => m.status === "open");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const otherMarkets = markets.filter((m) => !["open", "upcoming"].includes(m.status));

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
      {/* ↓ flex column + gap replaces marginBottom on each section, fixing margin collapse */}
      <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
        {openMarkets.length > 0 && (
          <section>
            <h2 style={{ color: "#4CAF50", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
              🟢 Active Markets
            </h2>
            <MarketGrid markets={openMarkets} />
          </section>
        )}

        {upcomingMarkets.length > 0 && (
          <section>
            <h2 style={{ color: "#708499", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
              Upcoming
            </h2>
            <MarketGrid markets={upcomingMarkets} />
          </section>
        )}

        {otherMarkets.length > 0 && (
          <section>
            <h2 style={{ color: "#708499", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
              Settled
            </h2>
            <MarketGrid markets={otherMarkets} />
          </section>
        )}

        {markets.length === 0 && (
          <div style={{ textAlign: "center", color: "#708499", padding: "60px 0" }}>
            <div>No markets available yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}