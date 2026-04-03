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
      pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
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
      background: "var(--glass-bg)",
      backdropFilter: "var(--glass-blur)",
      WebkitBackdropFilter: "var(--glass-blur)",
      border: "1px solid var(--glass-border)",
      borderRadius: "var(--radius-lg)",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      boxSizing: "border-box",
      gap: 12,
      position: "relative",
      boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
      transition: "all 0.2s ease",
      cursor: "pointer",
    }}
    onClick={() => navigate(`/market/${market.id}`)}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = "var(--shadow-md)";
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.borderColor = "var(--text-accent)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.borderColor = "var(--glass-border)";
    }}
    >
      {(isUpcoming || isResolving) && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: isUpcoming ? "#3b82f6" : "#f59e0b",
          color: "#fff", padding: "2px 8px", fontSize: "0.6rem", fontWeight: 800,
          borderRadius: 4, textTransform: "uppercase"
        }}>
          {isUpcoming ? "Soon" : "Resolving"}
        </div>
      )}

      <h3 style={{
        fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.4, color: "var(--text-main)",
        margin: 0, minHeight: "2.8em", overflow: "hidden", display: "-webkit-box", 
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical", 
        fontFamily: "var(--font-display)", paddingRight: (isUpcoming || isResolving) ? 40 : 0
      }}>
        {market.title}
      </h3>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
        {isResolving ? (
          <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", border: "1px dashed var(--glass-border)", fontSize: "0.75rem", color: "#f59e0b", fontWeight: 700, textAlign: "center" }}>
            Currently Resolving
          </div>
        ) : isUpcoming ? (
          <div style={{ flex: 1, padding: "10px", borderRadius: 10, background: "var(--bg-main)", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textAlign: "center" }}>
            Opens {countdown}
          </div>
        ) : (
          displayOutcomes.map((s) => (
            <button
              key={s.id}
              onClick={(e) => { e.stopPropagation(); onBet(s.id); }}
              style={{
                flex: showAll ? "1 1 45%" : 1, padding: "8px 4px", borderRadius: 10,
                border: `1px solid ${s.color}20`, 
                background: `${s.color}10`,
                cursor: "pointer", transition: "all 0.15s ease",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = s.color + "25";
                e.currentTarget.style.borderColor = s.color + "40";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = s.color + "10";
                e.currentTarget.style.borderColor = s.color + "20";
              }}
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: "1rem", fontWeight: 900, color: s.color }}>{s.pct.toFixed(0)}%</div>
            </button>
          ))
        )}
      </div>

      {market.outcomes.length > 2 && !isResolving && !isUpcoming && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAll(!showAll); }}
          style={{
            background: "none", border: "none", padding: "4px", fontSize: "0.7rem",
            color: "var(--text-accent)", fontWeight: 700, cursor: "pointer",
            textAlign: "center", width: "100%", marginTop: -4
          }}
        >
          {showAll ? "Show Less" : `View ${market.outcomes.length - 2} more...`}
        </button>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.6rem", color: "var(--text-subtle)", fontWeight: 700, paddingTop: 8, borderTop: "1px solid var(--glass-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
           <span style={{ color: "#22c55e" }}>Nu {Number(market.totalPool).toLocaleString()}</span>
           <span>Pool</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.8 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {(!isUpcoming && !isResolving) ? countdown : "Closed"}
        </div>
      </div>
    </div>
  );
};
