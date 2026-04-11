import { useState, useEffect, type FC } from "react";
import { useNavigate } from "react-router-dom";
import type { Market } from "@/api/client";

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
      if (ms <= 0) { setLabel("Expired"); return; }
      const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(h > 24 ? `${Math.floor(h / 24)}d left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`);
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
  const navigate = useNavigate();
  const isUpcoming = market.status === "upcoming";
  const isResolving = market.status === "resolving";
  const countdown = useCountdown(isUpcoming ? market.opensAt ?? null : market.closesAt);
  const totalPool = Number(market.totalPool);

  const sentiment = (() => {
    const raw = market.outcomes.map((o) => ({
      ...o,
      pct:
        o.lmsrProbability != null && o.lmsrProbability > 0
          ? o.lmsrProbability * 100
          : totalPool > 0
            ? (Number(o.totalBetAmount) / totalPool) * 100
            : 100 / market.outcomes.length,
    }));
    const sorted = [...raw].sort((a, b) => b.pct - a.pct);
    return raw.map((o) => {
      const rank = sorted.findIndex((s) => s.id === o.id);
      return { ...o, color: outcomeColor(rank, raw.length) };
    });
  })();

  const displayOutcomes = showAll ? sentiment : sentiment.slice(0, 2);

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "none",
      borderRadius: 20,
      padding: "18px 16px",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      boxSizing: "border-box",
      gap: 12,
      position: "relative",
      boxShadow: "6px 6px 16px rgba(0,0,0,0.35), -3px -3px 10px rgba(255,255,255,0.04)",
      transition: "all 0.2s ease",
      cursor: "pointer",
    }}
    onClick={() => navigate(`/market/${market.id}`)}
    >
      <style>{`@keyframes shimmer-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
      
      {(isUpcoming || isResolving) && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: isUpcoming ? "#3b82f6" : "#f59e0b",
          color: "#fff", padding: "2px 8px", fontSize: "0.6rem", fontWeight: 800,
          borderRadius: 4, textTransform: "uppercase", zIndex: 1
        }}>
          {isUpcoming ? "Soon" : "Wait"}
        </div>
      )}

      <h3 style={{
        fontSize: "0.95rem", fontWeight: 700, lineHeight: 1.4, color: "var(--text-main)",
        margin: 0, minHeight: "2.8em", overflow: "hidden", display: "-webkit-box", 
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical", 
        fontFamily: "var(--font-display)", paddingRight: (isUpcoming || isResolving) ? 45 : 0
      }}>
        {market.title}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
        {isResolving ? (
          <div style={{ 
            padding: "13px 16px", borderRadius: 14, background: "#fffbeb10", 
            border: "1.5px dashed #f59e0b50", fontSize: "0.8rem", color: "#f59e0b", 
            fontWeight: 800, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Resolving soon
          </div>
        ) : isUpcoming ? (
          <div style={{ 
            padding: "13px 16px", borderRadius: 14, background: "rgba(59,130,246,0.06)", 
            border: "1.5px solid rgba(59,130,246,0.2)", fontSize: "0.8rem", color: "#3b82f6", 
            fontWeight: 700, textAlign: "center" 
          }}>
            Opens {countdown}
          </div>
        ) : (
          displayOutcomes.map((s) => {
            const barWidth = Math.max(4, Math.min(100, s.pct));
            return (
              <button
                key={s.id}
                onClick={(e) => { e.stopPropagation(); onBet(s.id); }}
                style={{
                  width: "100%", padding: "0", borderRadius: 16, background: "var(--bg-card)",
                  border: "none", cursor: "pointer", overflow: "hidden",
                  boxShadow: `4px 4px 10px rgba(0,0,0,0.25), -2px -2px 8px rgba(255,255,255,0.04), inset 0 0 0 1px ${s.color}30`,
                  transition: "all 0.15s ease", display: "block", textAlign: "left", position: "relative"
                }}
              >
                {/* Pool fill */}
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0, width: `${barWidth}%`,
                  background: `linear-gradient(90deg, ${s.color}44 0%, ${s.color}22 60%, transparent 100%)`,
                  borderRadius: "16px 0 0 16px", transition: "width 1s ease", pointerEvents: "none"
                }}/>
                {/* Shimmer sweep */}
                <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 16, pointerEvents: "none" }}>
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, width: "40%",
                    background: `linear-gradient(90deg, transparent, ${s.color}15, transparent)`,
                    animation: "shimmer-slide 2.4s ease-in-out infinite"
                  }}/>
                </div>
                {/* Content */}
                <div style={{ position: "relative", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                   <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                     {s.label}
                   </span>
                   <div style={{
                     background: `${s.color}12`, border: `1px solid ${s.color}30`, color: s.color,
                     fontSize: "0.72rem", fontWeight: 800, padding: "2px 8px", borderRadius: 99, flexShrink: 0
                   }}>
                     {s.pct.toFixed(0)}%
                   </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {market.outcomes.length > 2 && !isResolving && !isUpcoming && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(!showAll); }}
          style={{
            background: "transparent", border: "1.5px solid var(--glass-border)", padding: "7px 10px",
            borderRadius: 10, fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700,
            cursor: "pointer", textAlign: "center", width: "100%", marginTop: 4
          }}
        >
          {showAll ? "Show Less ▲" : `+${market.outcomes.length - 2} more options`}
        </button>
      )}

      <div style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.65rem", 
        color: "var(--text-subtle)", fontWeight: 800, paddingTop: 10, borderTop: "1px solid var(--glass-border)",
        marginTop: 4
      }}>
        <div style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
           <span>Nu {Number(market.totalPool).toLocaleString()}</span>
           <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>Pool</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.8 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {(!isUpcoming && !isResolving) ? countdown : "Closed"}
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
              background: "none",
              border: "1px solid var(--glass-border)",
              borderRadius: 8,
              padding: "4px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--text-subtle)",
              fontSize: "0.65rem",
              fontWeight: 800,
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--text-muted)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--glass-border)"}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
