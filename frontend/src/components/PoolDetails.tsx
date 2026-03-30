import { useState, useEffect } from 'react';
import type { Market } from '@/api/client';

const OUTCOME_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

function useRelativeTime(date: Date | null): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!date) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 10) setLabel('just now');
      else if (secs < 60) setLabel(`${secs}s ago`);
      else if (secs < 3600) setLabel(`${Math.floor(secs / 60)}m ago`);
      else setLabel(`${Math.floor(secs / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [date]);
  return label;
}

export function PoolDetails({ market, lastUpdated }: { market: Market; lastUpdated?: Date | null }) {
  const [open, setOpen] = useState(false);
  const relativeTime = useRelativeTime(lastUpdated ?? null);
  const totalPool = Number(market.totalPool);

  const outcomes = market.outcomes.map((o, i) => ({
    ...o,
    pct: totalPool > 0 ? (Number(o.totalBetAmount) / totalPool) * 100 : 100 / market.outcomes.length,
    color: OUTCOME_COLORS[i % OUTCOME_COLORS.length],
  }));

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 10, fontWeight: 600, color: '#9ca3af',
        }}
      >
        {/* info icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {open ? 'Hide pool details' : 'Pool details'}
        {/* chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
          background: '#ffffff', borderRadius: 10,
          border: '1px solid #e5e7eb', padding: '10px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          zIndex: 20, minWidth: 220,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Pool Breakdown
          </div>
          {outcomes.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ flex: 1, fontSize: 11, color: '#374151', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.label}
              </span>
              <div style={{ width: 52, height: 3, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${o.pct}%`, height: '100%', background: o.color }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: o.color, minWidth: 26, textAlign: 'right', flexShrink: 0 }}>
                {o.pct.toFixed(0)}%
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', minWidth: 64, textAlign: 'right', flexShrink: 0 }}>
                Nu {Number(o.totalBetAmount).toLocaleString()}
              </span>
            </div>
          ))}
          <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Total pool</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Nu {totalPool.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>Platform fee</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{market.houseEdgePct}%</span>
          </div>
          {relativeTime && (
            <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 5, textAlign: 'right' }}>
              Updated {relativeTime}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
