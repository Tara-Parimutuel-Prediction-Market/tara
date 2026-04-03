// import { useState } from 'react';
import type { Market } from '@/api/client';

function Row({ label, value, muted, bold, green }: {
  label: string; value: string;
  muted?: boolean; bold?: boolean; green?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
      <span style={{ fontSize: 11, color: muted ? '#9ca3af' : '#6b7280' }}>{label}</span>
      <span style={{ fontSize: bold ? 12 : 11, fontWeight: bold ? 700 : 500, color: green ? '#16a34a' : '#374151' }}>
        {value}
      </span>
    </div>
  );
}

export function PayoutBreakdown({ market, outcomeId, betAmount }: {
  market: Market;
  outcomeId: string;
  betAmount: number;
}) {
  // const [open, setOpen] = useState(false);

  const outcome = market.outcomes.find((o) => o.id === outcomeId);
  if (!outcome || betAmount <= 0) return null;

  const houseEdgePct = parseFloat(market.houseEdgePct) || 0;
  const curOutcomePool = Number(outcome.totalBetAmount);
  const curTotalPool = Number(market.totalPool);
  const newOutcomePool = curOutcomePool + betAmount;
  const newTotalPool = curTotalPool + betAmount;
  const yourShare = newOutcomePool > 0 ? betAmount / newOutcomePool : 0;
  const grossPayout = yourShare * newTotalPool;
  const houseDeduction = grossPayout * (houseEdgePct / 100);
  const netPayout = grossPayout - houseDeduction;
  const profit = netPayout - betAmount;

  const nu = (n: number) => `Nu ${n.toFixed(2)}`;
  const nuInt = (n: number) => `Nu ${Math.round(n).toLocaleString()}`;

  return (
    <div style={{ marginTop: 6 }}>
      {/* <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: '#6b7280',
        }}
      > */}
        {/* calculator icon */}
        {/* <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" />
          <line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" />
          <line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="10" y2="18" />
          <line x1="14" y1="18" x2="16" y2="18" />
        </svg> */}
        {/* How is this calculated?
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button> */}

      {false && (
        <div style={{
          marginTop: 8, background: '#f8fafc', borderRadius: 8,
          border: '1px solid #e5e7eb', padding: '12px 14px',
        }}>
          {/* Pool state */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Pool state
          </div>
          <Row label={`[${outcome?.label}] pool`} value={nuInt(curOutcomePool)} />
          <Row label="Total pool" value={nuInt(curTotalPool)} />

          <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0' }} />

          {/* After your bet */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            After your bet of {nu(betAmount)}
          </div>
          <Row label={`[${outcome?.label}] pool`} value={nuInt(newOutcomePool)} />
          <Row label="Total pool" value={nuInt(newTotalPool)} />
          <Row label="Your share" value={`${(yourShare * 100).toFixed(2)}%`} />

          <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0' }} />

          {/* Calculation */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Calculation
          </div>
          <Row label="Gross payout" value={nu(grossPayout)} />
          <Row label={`Platform fee (${houseEdgePct}%)`} value={`−${nu(houseDeduction)}`} muted />
          <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
          <Row label="Est. payout if win" value={nu(netPayout)} bold green />
          <Row label="Est. profit" value={`+${nu(profit)}`} bold green />

          {/* <div style={{
            marginTop: 10, padding: '7px 10px', background: '#eff6ff',
            borderRadius: 6, border: '1px solid #bfdbfe',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', marginBottom: 2 }}>Formula</div>
            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.6, fontFamily: 'monospace' }}>
              (bet ÷ new {outcome?.label} pool) × new total pool × (1 − house%)<br />
              ({betAmount} ÷ {newOutcomePool.toFixed(0)}) × {newTotalPool.toFixed(0)} × {(1 - houseEdgePct / 100).toFixed(2)} = {nu(netPayout)}
            </div>
          </div> */}
        </div>
      )}
    </div>
  );
}
