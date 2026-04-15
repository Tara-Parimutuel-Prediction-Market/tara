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

    const socket = io(`${WS_URL}/markets`, {
      query: { marketId },
      transports: ["websocket", "polling"], // allow polling fallback
      reconnectionDelay: 2000,
      reconnectionAttempts: 20,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Re-emit the marketId room subscription after reconnect
      // (handshake query is resent automatically by socket.io on reconnect)
      console.debug(
        `[WS] connected to market:${marketId} socket id=${socket.id}`,
      );
    });

    socket.on("market_updated", (payload: MarketUpdate) => {
      console.debug(`[WS] market_updated for ${payload.marketId}`, payload);
      if (payload.marketId === marketId) {
        setUpdate(payload);
      }
    });

    socket.on("connect_error", (err) => {
      console.warn(`[WS] connect_error: ${err.message}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [marketId]);

  return update;
}
