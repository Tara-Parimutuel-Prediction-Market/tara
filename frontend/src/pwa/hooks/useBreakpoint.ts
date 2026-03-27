import { useState, useEffect } from "react";

type Breakpoint = "mobile" | "tablet" | "desktop";

function get(w: number): Breakpoint {
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    get(typeof window !== "undefined" ? window.innerWidth : 1200)
  );
  useEffect(() => {
    const fn = () => setBp(get(window.innerWidth));
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return bp;
}
