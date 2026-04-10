import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Wallet, 
  Calendar, 
  ChevronRight,
  ArrowUpRight,
  RefreshCcw,
  Target
} from "lucide-react";
import { getMyBets, type Bet } from "@/api/client";

const STATUS_COLOR: Record<Bet["status"], string> = {
  pending: "#f59e0b",
  won: "#22c55e",
  lost: "#ef4444",
  refunded: "#64748b",
};

const STATUS_BG_LIGHT: Record<Bet["status"], string> = {
  pending: "rgba(245, 158, 11, 0.1)",
  won: "rgba(34, 197, 94, 0.1)",
  lost: "rgba(239, 68, 68, 0.1)",
  refunded: "rgba(100, 116, 139, 0.1)",
};

const STATUS_LABEL: Record<Bet["status"], string> = {
  pending: "Active",
  won: "Won",
  lost: "Lost",
  refunded: "Refunded",
};

const STATUS_ICON = {
  pending: Clock,
  won: CheckCircle2,
  lost: XCircle,
  refunded: RefreshCcw,
};



function BetCard({ bet }: { bet: Bet }) {
  const color = STATUS_COLOR[bet.status];
  const Icon = STATUS_ICON[bet.status];
  const pool = bet.market ? Number(bet.market.totalPool) : 0;
  const edge = bet.market ? Number(bet.market.houseEdgePct) : 5;
  const outcomePool = bet.outcome ? Number(bet.outcome.totalBetAmount) : 0;
  
  const displayOdds = useMemo(() => {
    if (outcomePool > 0 && pool > 0) {
      return ((pool * (1 - edge / 100)) / outcomePool).toFixed(2);
    }
    return bet.oddsAtPlacement ? Number(bet.oddsAtPlacement).toFixed(2) : "—";
  }, [pool, edge, outcomePool, bet.oddsAtPlacement]);

  const isPending = bet.status === "pending";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isPending ? "var(--glass-border)" : color + "33"}`,
        borderRadius: 20,
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        boxShadow: isPending 
          ? "var(--shadow-sm)" 
          : `0 8px 20px ${color}11`,
        overflow: "hidden",
      }}
    >
      {/* Dynamic Status Glow */}
      {!isPending && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 4,
          bottom: 0,
          background: color,
        }} />
      )}

      {/* Header: Market Title & Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={12} style={{ color: "var(--text-subtle)" }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-subtle)" }}>
              {new Date(bet.placedAt).toLocaleDateString()}
            </span>
          </div>
          <h3 style={{
            fontSize: "0.95rem",
            fontWeight: 800,
            color: "var(--text-main)",
            lineHeight: 1.3,
            margin: 0,
          }}>
            {bet.market?.title ?? "Market " + bet.marketId}
          </h3>
        </div>
        
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 10,
          background: STATUS_BG_LIGHT[bet.status],
          color: color,
        }}>
          <Icon size={12} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {STATUS_LABEL[bet.status]}
          </span>
        </div>
      </div>

      {/* Prediction Section */}
      <div style={{
        background: "var(--bg-secondary)",
        borderRadius: 12,
        padding: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
          }}>
            <Target size={18} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Your Pick</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}>
              {bet.outcome?.label ?? "Outcome " + bet.outcomeId}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Odds</span>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-main)" }}>{displayOdds}x</div>
        </div>
      </div>

      {/* Financials Row */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        padding: "0 4px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wallet size={14} style={{ color: "var(--text-subtle)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
            Nu {Number(bet.amount).toLocaleString()}
          </span>
        </div>

        {bet.payout != null ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "#22c55e",
            fontWeight: 800,
            fontSize: 14,
          }}>
            <ArrowUpRight size={16} />
            <span>Nu {Number(bet.payout).toLocaleString()}</span>
          </div>
        ) : (
          <Link
            to={`/market/${bet.marketId}`}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Details <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

export function PwaMyBetsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState<Bet["status"] | "all">("all");

  const changeFilter = (key: Bet["status"] | "all") => {
    setFilter(key);
    setShowAll(false);
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMyBets()
      .then(setBets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "all" ? bets : bets.filter((b) => b.status === filter);

  const tabs: Array<{ key: Bet["status"] | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "pending", label: "Active" },
    { key: "won", label: "Won" },
    { key: "lost", label: "Lost" },
    { key: "refunded", label: "Refunded" },
  ];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      <h1
        style={{
          fontSize: "1.7rem",
          fontWeight: 900,
          marginBottom: 6,
          color: "var(--text-main)",
          letterSpacing: "-0.02em",
        }}
      >
        My Picks
      </h1>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--text-muted)",
          marginBottom: 24,
          fontWeight: 600,
        }}
      >
        Tracking your prediction performance
      </p>



      {/* Filter tabs */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => changeFilter(t.key)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid var(--glass-border)",
              background:
                filter === t.key ? "var(--accent)" : "var(--bg-card)",
              color: filter === t.key ? "#fff" : "var(--text-main)",
              boxShadow: filter === t.key ? "0 4px 12px rgba(59, 130, 246, 0.3)" : "none",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.key !== "all" && (
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                ({bets.filter((b) => b.status === t.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--text-subtle)",
          }}
        >
          Loading…
        </div>
      )}
      {error && (
        <div
          style={{ textAlign: "center", padding: "40px 0", color: "#ef4444" }}
        >
          {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--text-subtle)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-subtle)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 12 }}
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          <div>
            No predictions yet.{" "}
            <Link to="/markets" style={{ color: "var(--accent)" }}>
              Browse markets →
            </Link>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.slice(0, showAll ? undefined : 5).map((bet) => (
          <BetCard key={bet.id} bet={bet} />
        ))}
      </div>
      {filtered.length > 5 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: 12,
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            color: "var(--text-main)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showAll ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {showAll ? "Show Less" : `View More (${filtered.length - 5} more)`}
        </button>
      )}
    </div>
  );
}
