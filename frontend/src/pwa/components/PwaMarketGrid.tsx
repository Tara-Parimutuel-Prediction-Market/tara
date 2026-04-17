import { type FC, type ReactNode } from "react";
import { useBreakpoint } from "../hooks/useBreakpoint";

interface PwaMarketGridProps {
  children: ReactNode;
}

export const PwaMarketGrid: FC<PwaMarketGridProps> = ({ children }) => {
  const bp = useBreakpoint();
  const gridCols = bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: gridCols, 
      gap: "var(--space-lg)", 
      alignItems: "stretch" 
    }}>
      {children}
    </div>
  );
};
