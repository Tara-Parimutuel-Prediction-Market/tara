import { FC, useEffect, useState } from "react";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
import { Page } from "@/tma/components/Page";
import { Link } from "@/tma/components/Link/Link";
import { getResolvedMarkets, ResolvedMarket } from "@/api/client";

const categoryLabel: Record<string, string> = {
  sports: "Sports",
  politics: "Politics",
  weather: "Weather",
  entertainment: "Entertainment",
  economy: "Economy",
  other: "Other",
};

function EvidencePanel({ m }: { m: ResolvedMarket }) {
  const [expanded, setExpanded] = useState(false);
  const hasEvidence = !!m.evidence?.url || !!m.evidence?.note;
  const hasDispute = m.objectionCount > 0;

  if (!hasEvidence && !hasDispute) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--glass-border)",
        paddingTop: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onClick={(e) => e.preventDefault()} // stop Link navigation when tapping inside
    >
      {/* Dispute banner */}
      {hasDispute && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 8,
            background: m.outcomeChanged
              ? "rgba(239,68,68,0.08)"
              : "rgba(245,158,11,0.08)",
            border: `1px solid ${m.outcomeChanged ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
          }}
        >
          {m.outcomeChanged ? (
            // Warning triangle
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            // Ballot box / vote
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <polyline points="9 11 12 14 22 4" />
            </svg>
          )}
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: m.outcomeChanged ? "#ef4444" : "#d97706",
              lineHeight: 1.4,
            }}
          >
            {m.objectionCount} objection{m.objectionCount !== 1 ? "s" : ""}{" "}
            filed
            {m.outcomeChanged
              ? " — outcome was revised after review"
              : " — original outcome upheld"}
          </span>
        </div>
      )}

      {/* Evidence row */}
      {hasEvidence && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setExpanded((v) => !v);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--text-subtle)",
              fontSize: "0.72rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Evidence {expanded ? "▲" : "▼"}
          </button>

          {expanded && (
            <div
              style={{
                background: "var(--bg-secondary)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {m.evidence.note && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {m.evidence.note}
                </p>
              )}
              {m.evidence.url && (
                <a
                  href={m.evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#2775d0",
                    textDecoration: "none",
                    wordBreak: "break-all",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View Source
                </a>
              )}
              {m.evidence.submittedAt && (
                <div
                  style={{ fontSize: "0.68rem", color: "var(--text-subtle)" }}
                >
                  Submitted{" "}
                  {new Date(m.evidence.submittedAt).toLocaleDateString(
                    "en-BT",
                    {
                      timeZone: "Asia/Thimphu",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ResolvedMarketsPage: FC = () => {
  const [markets, setMarkets] = useState<ResolvedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getResolvedMarkets()
      .then(setMarkets)
      .catch((e: any) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Page back={true}>
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Spinner size="l" />
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page back={true}>
        <Placeholder header="Error" description={error} />
      </Page>
    );
  }

  return (
    <Page back={true}>
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          padding: "0 0 100px",
        }}
      >
        <div className="mesh-bg" />
        <div
          style={{
            padding: "48px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              color: "var(--text-subtle)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Resolution Record — {markets.length} market
            {markets.length !== 1 ? "s" : ""}
          </div>

          {markets.length === 0 && (
            <Placeholder
              header="No resolved markets yet"
              description="Settled markets will appear here."
            />
          )}

          {markets.map((m) => (
            <Link
              key={m.id}
              to={`/market/${m.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${m.objectionCount > 0 ? (m.outcomeChanged ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)") : "var(--glass-border)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "18px",
                  boxShadow: "var(--shadow-premium)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Title + category */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 900,
                      color: "var(--text-main)",
                      fontSize: "0.95rem",
                      lineHeight: 1.3,
                      flex: 1,
                    }}
                  >
                    {m.title}
                  </span>
                  {m.category && (
                    <span
                      style={{
                        background: "var(--bg-secondary)",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        color: "var(--text-subtle)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {categoryLabel[m.category] ?? m.category}
                    </span>
                  )}
                </div>

                {/* Winner */}
                {m.winner && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "#31eb78ff",
                        fontSize: "0.85rem",
                      }}
                    >
                      {m.winner.label}
                    </span>
                  </div>
                )}

                {/* Resolution criteria */}
                {m.resolutionCriteria && (
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-subtle)",
                      lineHeight: 1.5,
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    "{m.resolutionCriteria}"
                  </p>
                )}

                {/* Stats row */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    Nu {Number(m.totalPool).toLocaleString()} pool
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {m.participantCount} bettors
                  </div>
                  {m.resolvedAt && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                      }}
                    >
                      {new Date(m.resolvedAt).toLocaleDateString("en-BT", {
                        timeZone: "Asia/Thimphu",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>

                {/* Evidence + dispute panel */}
                <EvidencePanel m={m} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Page>
  );
};
