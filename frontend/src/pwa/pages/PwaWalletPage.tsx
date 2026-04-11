import { useEffect, useState } from "react";
import {
  getMe,
  getMyTransactions,
  type AuthUser,
  type Transaction,
} from "@/api/client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Target,
  Trophy,
  RotateCcw,
  Lock,
  Unlock,
  Wallet,
  Plus,
  ArrowUpCircle,
  Clock,
  AlertCircle,
  UserPlus,
} from "lucide-react";

const TX_ICON: Record<Transaction["type"], React.ReactNode> = {
  deposit:        <ArrowDownLeft size={18} />,
  withdrawal:     <ArrowUpRight size={18} />,
  bet_placed:     <Target size={18} />,
  bet_payout:     <Trophy size={18} />,
  refund:         <RotateCcw size={18} />,
  dispute_bond:   <Lock size={18} />,
  dispute_refund: <Unlock size={18} />,
  referral_bonus: <UserPlus size={18} />,
};

const TX_LABEL: Record<Transaction["type"], string> = {
  deposit:        "Top Up",
  withdrawal:     "Cash Out",
  bet_placed:     "Position opened",
  bet_payout:     "Returns",
  refund:         "Refund",
  dispute_bond:   "Dispute bond",
  dispute_refund: "Bond refund",
  referral_bonus: "Referral bonus",
};

function TxRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.amount > 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px",
        background: "var(--bg-card)",
        border: "1px solid var(--glass-border)",
        borderRadius: 16,
        marginBottom: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: isCredit
            ? "rgba(34, 197, 94, 0.1)"
            : "rgba(59, 130, 246, 0.1)",
          color: isCredit ? "#22c55e" : "#3b82f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {TX_ICON[tx.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "var(--text-main)",
          }}
        >
          {TX_LABEL[tx.type]}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-subtle)",
            marginTop: 2,
          }}
        >
          {new Date(tx.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            color: isCredit ? "#22c55e" : "var(--text-main)",
          }}
        >
          {isCredit ? "+" : ""}
          {Number(tx.amount).toLocaleString()}
        </div>
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--text-subtle)",
            marginTop: 2,
          }}
        >
          Bal {Number(tx.balanceAfter).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export function PwaWalletPage() {
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMe(), getMyTransactions()])
      .then(([p, t]) => {
        setProfile(p);
        setTxs(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalIn = txs
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = txs
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div
      style={{
        padding: "32px 16px 100px",
        maxWidth: 600,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <div className="mesh-bg" />

      <h1
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "var(--text-main)",
          marginBottom: 24,
          paddingLeft: 4,
          fontFamily: "var(--font-display)",
        }}
      >
        Wallet
      </h1>

      {loading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "100px 0",
            gap: 16,
          }}
        >
          <div className="spinner" />
          <span style={{ color: "var(--text-subtle)", fontWeight: 600 }}>
            Syncing balance...
          </span>
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
          <p style={{ color: "#ef4444", fontWeight: 700 }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 12,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-main)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && profile && (
        <>
          {/* Balance card */}
          <div
            style={{
              background: "var(--balance-card-bg)",
              borderRadius: "var(--radius-xl)",
              padding: "24px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "var(--balance-card-shadow)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                background: "rgba(255,255,255,0.1)",
                borderRadius: "50%",
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.8)",
                  marginBottom: 8,
                }}
              >
                Available Balance
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 24,
                }}
              >
                <span
                  style={{ fontSize: "2.4rem", fontWeight: 900, color: "#fff" }}
                >
                  {Number(profile.creditsBalance).toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  BTN
                </span>
              </div>

              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                    }}
                  >
                    Total In
                  </div>
                  <div
                    style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}
                  >
                    +{totalIn.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Out
                  </div>
                  <div
                    style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}
                  >
                    {Math.abs(totalOut).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 32,
            }}
          >
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "16px",
                borderRadius: 16,
                background: "var(--deposit-btn-bg)",
                color: "#fff",
                border: "none",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(39,117,208,0.25)",
              }}
            >
              <Plus size={20} />
              Top Up
            </button>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "16px",
                borderRadius: 16,
                background: "var(--bg-card)",
                color: "var(--text-main)",
                border: "1px solid var(--glass-border)",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }}
            >
              <ArrowUpCircle size={20} />
              Cash Out
            </button>
          </div>

          {/* Transaction list */}
          <div style={{ padding: "0 4px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "var(--text-main)",
                    margin: 0,
                    fontFamily: "var(--font-display)",
                  }}
                >
                  History
                </h2>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-subtle)",
                    marginTop: 2,
                  }}
                >
                  {txs.length} transaction{txs.length !== 1 ? "s" : ""}
                </div>
              </div>
              <Clock size={16} color="var(--text-subtle)" />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {txs.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 0",
                    color: "var(--text-subtle)",
                  }}
                >
                  <Wallet
                    size={48}
                    strokeWidth={1.5}
                    style={{ marginBottom: 12, opacity: 0.5 }}
                  />
                  <p style={{ fontWeight: 600 }}>No transactions yet</p>
                </div>
              ) : (
                txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
