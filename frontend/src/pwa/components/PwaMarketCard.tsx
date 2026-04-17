import { useState, useEffect, type FC } from "react";
import { useNavigate } from "react-router-dom";
import type { Market } from "@/api/client";
import { getCategoryVisual } from "@/helpers/visuals";

function outcomeColor(rank: number, total: number): string {
  if (rank === 0) return "#22c55e";
  if (rank === total - 1 && total > 1) return "#ef4444";
  return "#f59e0b";
}

function useCountdown(targetAt: string | null): string {
  const [label, setLabel] = useState("Open");
  useEffect(() => {
    if (!targetAt) return;
    const tick = () => {
      const ms = new Date(targetAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Expired");
        return;
      }
      const h = Math.floor(ms / 3_600_000),
        m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(
        h > 24
          ? `${Math.floor(h / 24)}d left`
          : h > 0
            ? `${h}h ${m}m left`
            : `${m}m left`,
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [targetAt]);
  return label;
}

interface PwaMarketCardProps {
  market: Market;
  onBet: (outcomeId: string) => void;
}

export const PwaMarketCard: FC<PwaMarketCardProps> = ({ market, onBet }) => {
  const [showAll, setShowAll] = useState(false);
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();
  const isUpcoming = market.status === "upcoming";
  const isResolving = market.status === "resolving";
  const countdown = useCountdown(
    isUpcoming ? (market.opensAt ?? null) : market.closesAt,
  );
  const totalPool = Number(market.totalPool);

  const sentiment = (() => {
    const n = market.outcomes.length || 1;
    const raw = market.outcomes.map((o) => ({
      ...o,
      pct:
        totalPool > 0
          ? (Number(o.totalBetAmount) / totalPool) * 100
          : o.lmsrProbability != null && o.lmsrProbability > 0
            ? o.lmsrProbability * 100
            : 100 / n,
    }));
    const sorted = [...raw].sort((a, b) => b.pct - a.pct);
    return raw.map((o) => {
      const rank = sorted.findIndex((s) => s.id === o.id);
      return { ...o, color: outcomeColor(rank, raw.length) };
    });
  })();

  const displayOutcomes = showAll ? sentiment : sentiment.slice(0, 2);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        boxShadow: "6px 6px 16px rgba(0,0,0,0.3), -3px -3px 10px rgba(255,255,255,0.04)",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        cursor: "pointer",
        overflow: "hidden",
      }}
      onClick={() => navigate(`/market/${market.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "8px 8px 20px rgba(0,0,0,0.35), -4px -4px 12px rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "6px 6px 16px rgba(0,0,0,0.3), -3px -3px 10px rgba(255,255,255,0.04)";
      }}
    >
      <style>{`@keyframes shimmer-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>


      {/* Card body */}
      <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>

        {/* Header row: category badge + status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
          {market.category && (() => {
            const vis = getCategoryVisual(market.category);
            return (
              <span style={{
                fontSize: "0.58rem",
                fontWeight: 800,
                color: vis.accentColor,
                background: `${vis.accentColor}18`,
                border: `1px solid ${vis.accentColor}40`,
                padding: "1px 7px",
                borderRadius: 99,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                {market.category}
              </span>
            );
          })()}
          {(isUpcoming || isResolving) && (
            <span style={{
              fontSize: "0.58rem",
              fontWeight: 800,
              color: "#fff",
              background: isUpcoming ? "#3b82f6" : "#f59e0b",
              padding: "1px 7px",
              borderRadius: 4,
            }}>
              {isUpcoming ? "SOON" : "WAIT"}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: "0.95rem",
            fontWeight: 800,
            lineHeight: 1.35,
            color: "var(--text-main)",
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
          }}
        >
          {market.title}
        </h3>

      {/* ── Outcomes Area ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          justifyContent: isUpcoming || isResolving ? "center" : "flex-start",
        }}
      >
        {isResolving ? (
          <div
            style={{
              padding: "20px",
              borderRadius: "var(--radius-md)",
              background: "rgba(34,197,94,0.08)",
              border: "1.5px dashed var(--color-success)",
              fontSize: "0.85rem",
              color: "var(--color-success)",
              fontWeight: 800,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Resolving...
          </div>
        ) : isUpcoming ? (
          <div
            style={{
              padding: "20px",
              borderRadius: "var(--radius-md)",
              background: "rgba(59,130,246,0.08)",
              border: "1.5px solid rgba(59,130,246,0.2)",
              fontSize: "0.85rem",
              color: "var(--color-info)",
              fontWeight: 800,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Opens {countdown}
          </div>
        ) : (
          <>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}
            >
              {displayOutcomes.map((s, idx) => {
                const barWidth = Math.max(4, Math.min(100, s.pct));
                const avatarUrl = !imgError
                  ? (s as any).imageUrl ||
                    (idx === 0
                      ? market.imageUrl
                      : idx === 1
                        ? market.imageUrlAlt || market.imageUrl
                        : null)
                  : null;
                const vis = getCategoryVisual(market.category);
                return (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBet(s.id);
                    }}
                    style={{
                      width: "100%",
                      padding: "0",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-card)",
                      border: "none",
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "block",
                      textAlign: "left",
                      position: "relative",
                      boxShadow: `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`,
                      transition: "box-shadow 0.15s ease, transform 0.12s ease",
                    }}
                    onMouseDown={(e) => {
                      const el = e.currentTarget;
                      el.style.boxShadow = `inset 3px 3px 8px rgba(0,0,0,0.3), inset -1px -1px 4px rgba(255,255,255,0.03), inset 0 0 0 1px ${s.color}50`;
                      el.style.transform = "scale(0.985)";
                    }}
                    onMouseUp={(e) => {
                      const el = e.currentTarget;
                      el.style.boxShadow = `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`;
                      el.style.transform = "scale(1)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.boxShadow = `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`;
                      el.style.transform = "scale(1)";
                    }}
                  >
                    {/* Pool fill gradient */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${s.color}55 0%, ${s.color}28 60%, transparent 100%)`,
                        borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
                        transition: "width 1s ease",
                        pointerEvents: "none",
                      }}
                    />
                    {/* Shimmer sweep */}
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "var(--radius-md)", pointerEvents: "none" }}>
                      <div style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: "40%",
                        background: `linear-gradient(90deg, transparent, ${s.color}18, transparent)`,
                        animation: "shimmer-slide 2.4s ease-in-out infinite",
                      }} />
                    </div>
                    
                    {/* Content */}
                    <div
                      style={{
                        position: "relative",
                        padding: "7px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          flexShrink: 0,
                          width: 26,
                          height: 26,
                          borderRadius: "var(--radius-full)",
                          overflow: "hidden",
                          background: vis.gradient,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1.5px solid rgba(255,255,255,0.15)",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                        }}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt=""
                            onError={() => setImgError(true)}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 900,
                              color: "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                            }}
                          >
                            {s.label.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "var(--text-main)",
                          letterSpacing: "-0.01em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                        }}
                      >
                        {s.label}
                      </span>

                      <div
                        style={{
                          background: `${s.color}20`,
                          color: s.color,
                          fontSize: "0.7rem",
                          fontWeight: 900,
                          padding: "3px 8px",
                          borderRadius: "var(--radius-full)",
                          flexShrink: 0,
                          marginLeft: "auto",
                          boxShadow: `inset 0 0 0 1px ${s.color}30`,
                        }}
                      >
                        {s.pct.toFixed(0)}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {market.outcomes.length > 2 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAll(!showAll);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  padding: "5px 10px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  width: "100%",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--text-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                {showAll ? "Show Less" : `+ ${market.outcomes.length - 2} more`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.68rem",
          color: "var(--text-subtle)",
          fontWeight: 700,
          paddingTop: 8,
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        <div style={{ color: "var(--color-success)", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 900 }}>Nu {Number(market.totalPool).toLocaleString()}</span>
          <span style={{ fontSize: "0.58rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pool</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {!isUpcoming && !isResolving ? countdown : "Closed"}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const url = `${window.location.origin}/market/${market.id}`;
              const text = `Check out this prediction market: ${market.title}`;
              if (navigator.share) {
                navigator.share({ title: market.title, text, url }).catch(() => {});
              } else {
                navigator.clipboard.writeText(url);
                alert("Link copied to clipboard!");
              }
            }}
            style={{
              background: "var(--bg-secondary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "4px 9px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: "var(--text-muted)",
              fontSize: "0.68rem",
              fontWeight: 800,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-main)"; e.currentTarget.style.color = "var(--text-main)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
