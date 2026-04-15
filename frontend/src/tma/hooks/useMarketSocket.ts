import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/api\/?$/, "");

export interface MarketOutcomeUpdate {
  id: string;
  totalBetAmount: number;
  lmsrProbability: number | null;
  currentOdds: number;
}

export interface MarketUpdate {
  marketId: string;
  totalPool: number;
  outcomes: MarketOutcomeUpdate[];
}

/**
 * Subscribes to live market updates for a single market via WebSocket.
 * Returns the latest update payload (null until the first event arrives).
 *
 * Usage:
 *   const liveData = useMarketSocket(marketId);
 *   // liveData?.outcomes[i].lmsrProbability is always the latest value
 */
export function useMarketSocket(
  marketId: string | undefined,
): MarketUpdate | null {
  const [update, setUpdate] = useState<MarketUpdate | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!marketId) return;

    // Derive WS origin from the API base URL (strip /api path if present)
    const socket = io(`${WS_URL}/markets`, {
      query: { marketId },
      transports: ["websocket"],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("market_updated", (payload: MarketUpdate) => {
      if (payload.marketId === marketId) {
        setUpdate(payload);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [marketId]);

  return update;
}
