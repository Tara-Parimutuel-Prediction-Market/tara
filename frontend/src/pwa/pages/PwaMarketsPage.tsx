import { useState, useEffect } from "react";
import { getMarkets, placeBet, type Market } from "@/api/client";
import { PwaPaymentModal } from "../components/PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { PwaMarketCard } from "../components/PwaMarketCard";
import { PwaMarketGrid } from "../components/PwaMarketGrid";

export function PwaMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<{
    marketId: string;
    outcomeId: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getMarkets()
      .then(setMarkets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    setMarkets((prev) =>
      prev.map((m) => {
        if (m.id !== activeBet.marketId) return m;
        return {
          ...m,
          totalPool: String(Number(m.totalPool) + betAmt),
          outcomes: m.outcomes.map((o) =>
            o.id === activeBet.outcomeId
              ? {
                  ...o,
                  totalBetAmount: String(Number(o.totalBetAmount) + betAmt),
                }
              : o,
          ),
        };
      }),
    );

    setActiveBet(null);
    const market = markets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        await placeBet(market.id, {
          outcomeId: activeBet.outcomeId,
          amount: betAmt,
        });
      } catch (e: any) {
        console.warn(e.message);
      }
    }
    getMarkets().then(setMarkets).catch(console.error);
  };

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "100px 0",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-subtle)" }}>
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
              animation: "bounce 2s infinite",
            }}
          >
            🔮
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            Syncing predictions…
          </div>
        </div>
      </div>
    );

  const openMarkets = markets.filter((m) => m.status === "open");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const settledMarkets = markets.filter(
    (m) => !["open", "upcoming"].includes(m.status),
  );
  const activeMarket = activeBet
    ? markets.find((m) => m.id === activeBet.marketId)
    : null;

  const filterByQuery = (list: Market[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q),
    );
  };

  const filteredOpen = filterByQuery(openMarkets);
  const filteredUpcoming = filterByQuery(upcomingMarkets);
  const filteredSettled = filterByQuery(settledMarkets);
  const hasResults =
    filteredOpen.length + filteredUpcoming.length + filteredSettled.length > 0;

  const renderGrid = (items: Market[]) => (
    <PwaMarketGrid>
      {items.map((market) => (
        <PwaMarketCard
          key={market.id}
          market={market}
          onBet={(outcomeId) =>
            setActiveBet({ marketId: market.id, outcomeId })
          }
        />
      ))}
    </PwaMarketGrid>
  );

  return (
    <div
      style={{
        padding: "40px 24px 80px",
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      {/* ── Search bar ── */}
      <div style={{ position: "relative" }}>
        <svg
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-subtle)",
            pointerEvents: "none",
          }}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search markets…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 40px 12px 44px",
            borderRadius: 14,
            border: "1px solid var(--glass-border)",
            background: "var(--bg-card)",
            boxShadow: "var(--shadow-sm)",
            fontSize: 15,
            color: "var(--text-main)",
            outline: "none",
            fontFamily: "var(--font-primary)",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-subtle)",
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* No results */}
      {!hasResults && searchQuery.trim() && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 0",
            gap: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48 }}>🔍</div>
          <div
            style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)" }}
          >
            No markets found
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Try a different search term.
          </div>
        </div>
      )}

      {filteredOpen.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: "#ecfdf5",
                color: "#10b981",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              LIVE
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--text-main)",
                margin: 0,
                fontFamily: "var(--font-display)",
              }}
            >
              Active Markets
            </h2>
          </div>
          {renderGrid(filteredOpen)}
        </section>
      )}

      {filteredUpcoming.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: "#f1f5f9",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              SOON
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--text-main)",
                margin: 0,
                fontFamily: "var(--font-display)",
              }}
            >
              Coming Up
            </h2>
          </div>
          {renderGrid(filteredUpcoming)}
        </section>
      )}

      {filteredSettled.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: "#f1f5f9",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.05em",
              }}
            >
              SETTLED
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "var(--text-main)",
                margin: 0,
                fontFamily: "var(--font-display)",
              }}
            >
              History
            </h2>
          </div>
          {renderGrid(filteredSettled)}
        </section>
      )}

      {activeMarket && activeBet && (
        <PwaPaymentModal
          isOpen={true}
          onClose={() => setActiveBet(null)}
          market={activeMarket}
          outcomeId={activeBet.outcomeId}
          onSuccess={handlePaymentSuccess}
          onFailure={(e) => console.error(e)}
        />
      )}
    </div>
  );
}
