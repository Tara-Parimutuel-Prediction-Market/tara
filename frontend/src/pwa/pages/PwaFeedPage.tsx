import { useState, useEffect } from "react";
import { getMarkets, placeBet, type Market } from "@/api/client";
import { PwaPaymentModal } from "../components/PwaPaymentModal";
import type { PaymentResponse } from "@/types/payment";
import { PwaMarketCard } from "../components/PwaMarketCard";
import { PwaMarketGrid } from "../components/PwaMarketGrid";

interface ActiveBet { marketId: string; outcomeId: string; }

export function PwaFeedPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);

  useEffect(() => {
    getMarkets()
      .then((d) => {
        // Only show live/upcoming for feed
        setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming" || m.status === "resolving"));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePaymentSuccess = async (_payment: PaymentResponse) => {
    if (!activeBet) return;
    const betAmt = _payment?.amount ?? 0;

    setMarkets((prev) => prev.map((m) => {
      if (m.id !== activeBet.marketId) return m;
      return {
        ...m,
        totalPool: String(Number(m.totalPool) + betAmt),
        outcomes: m.outcomes.map((o) =>
          o.id === activeBet.outcomeId
            ? { ...o, totalBetAmount: String(Number(o.totalBetAmount) + betAmt) }
            : o
        ),
      };
    }));

    setActiveBet(null);

    const market = markets.find((m) => m.id === activeBet.marketId);
    if (market) {
      try {
        await placeBet(market.id, { outcomeId: activeBet.outcomeId, amount: betAmt });
      }
      catch (e: any) { console.warn(e.message); }
    }

    getMarkets()
      .then((d) => {
        setMarkets(d.filter((m) => m.status === "open" || m.status === "upcoming" || m.status === "resolving"));
      })
      .catch(console.error);
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "100px 0" }}>
      <div style={{ textAlign: "center", color: "var(--text-subtle)" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "bounce 2s infinite" }}>🔮</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Syncing predictions…</div>
      </div>
    </div>
  );

  if (!markets.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 32px", textAlign: "center", gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔮</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", fontFamily: "var(--font-display)" }}>No open predictions</div>
      <div style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 300 }}>The oracle is quiet. Check back later for new markets.</div>
    </div>
  );

  const openMarkets = markets.filter((m) => m.status === "open");
  const resolvingMarkets = markets.filter((m) => m.status === "resolving");
  const upcomingMarkets = markets.filter((m) => m.status === "upcoming");
  const activeMarket = activeBet ? markets.find((m) => m.id === activeBet.marketId) : null;

  const renderGrid = (items: Market[]) => (
    <PwaMarketGrid>
      {items.map((market) => (
        <PwaMarketCard
          key={market.id}
          market={market}
          onBet={(outcomeId) => setActiveBet({ marketId: market.id, outcomeId })}
        />
      ))}
    </PwaMarketGrid>
  );

  return (
    <div style={{ padding: "40px 24px 80px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
      {openMarkets.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ padding: "6px 12px", borderRadius: 20, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>LIVE</div>
          </div>
          {renderGrid(openMarkets)}
        </section>
      )}
      
      {resolvingMarkets.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ padding: "6px 12px", borderRadius: 20, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>WAITING</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", margin: 0, fontFamily: "var(--font-display)" }}>Dispute Window</h2>
          </div>
          {renderGrid(resolvingMarkets)}
        </section>
      )}

      {upcomingMarkets.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ padding: "6px 12px", borderRadius: 20, background: "var(--bg-main)", color: "var(--text-subtle)", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>SOON</div>
          </div>
          {renderGrid(upcomingMarkets)}
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
