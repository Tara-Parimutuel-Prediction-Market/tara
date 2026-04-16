
export const CATEGORY_VISUAL: Record<
  string,
  { gradient: string; accentColor: string }
> = {
  sports: {
    gradient: "linear-gradient(135deg, #1a3a5c 0%, #0f5132 60%, #1e4d2b 100%)",
    accentColor: "#22c55e",
  },
  politics: {
    gradient: "linear-gradient(135deg, #3b1f6e 0%, #1e3a8a 60%, #0f172a 100%)",
    accentColor: "#818cf8",
  },
  weather: {
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 60%, #082f49 100%)",
    accentColor: "#38bdf8",
  },
  entertainment: {
    gradient: "linear-gradient(135deg, #4a1942 0%, #831843 60%, #1f1f1f 100%)",
    accentColor: "#f472b6",
  },
  economy: {
    gradient: "linear-gradient(135deg, #1c2b1a 0%, #14532d 60%, #052e16 100%)",
    accentColor: "#4ade80",
  },
  other: {
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #0f0f23 100%)",
    accentColor: "#a78bfa",
  },
};

export function getCategoryVisual(category: string | null) {
  const key = (category ?? "other").toLowerCase();
  return CATEGORY_VISUAL[key] ?? CATEGORY_VISUAL["other"];
}
