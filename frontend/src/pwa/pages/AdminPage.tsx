import { useState, useEffect, useCallback } from 'react';
import { getMe, loginWithDKBank, type AuthUser, type Market, type Dispute } from '@/api/client';
import {
  adminGetMarkets, adminCreateMarket, adminTransition,
  adminPropose, adminResolve, adminCancel, adminDelete,
  adminGetMarketDisputes,
  adminGetUsers, adminGetPayments, adminGetSettlements,
  type AdminUser, type AdminPayment, type AdminSettlement, type CreateMarketPayload,
} from '@/api/admin';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#f1f5f9',
  sidebar: '#ffffff',
  card: '#ffffff',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  primaryBg: '#eff6ff',
  text: '#1e293b',
  sub: '#475569',
  muted: '#94a3b8',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#d97706',
  warningBg: '#fef3c7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  purple: '#7c3aed',
  purpleBg: '#ede9fe',
  teal: '#0891b2',
  tealBg: '#cffafe',
} as const;

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  upcoming:   { color: C.sub,     bg: '#f1f5f9' },
  open:       { color: C.success, bg: C.successBg },
  closed:     { color: C.warning, bg: C.warningBg },
  resolving:  { color: '#d97706', bg: '#fef3c7' },
  resolved:   { color: C.purple,  bg: C.purpleBg },
  settled:    { color: C.teal,    bg: C.tealBg },
  cancelled:  { color: C.danger,  bg: C.dangerBg },
  SUCCESS:    { color: C.success, bg: C.successBg },
  PENDING:    { color: C.warning, bg: C.warningBg },
  FAILED:     { color: C.danger,  bg: C.dangerBg },
};

function Badge({ label }: { label: string }) {
  const s = STATUS_STYLE[label] ?? { color: C.sub, bg: C.borderLight };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
      color: s.color, background: s.bg, textTransform: 'capitalize',
    }}>{label}</span>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', padding: '9px 16px', border: 'none', borderRadius: 8,
      background: active ? C.primaryBg : 'transparent',
      color: active ? C.primaryDark : C.sub,
      fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
      textAlign: 'left', transition: 'all 0.12s',
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{value}</div>
        </div>
        <div style={{ fontSize: 24, background: `${color}18`, borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{title}</h2>
      {action}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
function Table({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: C.card }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {cols.map((c) => (
              <th key={c} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding: '28px', textAlign: 'center', color: C.muted, fontSize: 13 }}>No data</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '11px 16px', fontSize: 13, color: C.text, whiteSpace: 'nowrap' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
function Btn({ label, onClick, variant = 'default', size = 'sm', disabled }: {
  label: string; onClick: () => void;
  variant?: 'primary' | 'danger' | 'default' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const styles = {
    primary: { bg: C.primary, color: '#fff', border: C.primary },
    danger:  { bg: C.dangerBg, color: C.danger, border: '#fca5a5' },
    default: { bg: '#f8fafc', color: C.sub, border: C.border },
    ghost:   { bg: 'transparent', color: C.sub, border: 'transparent' },
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: size === 'md' ? '10px 18px' : '5px 12px',
        borderRadius: 8, border: `1.5px solid ${styles.border}`,
        background: disabled ? '#f1f5f9' : styles.bg,
        color: disabled ? C.muted : styles.color,
        fontSize: size === 'md' ? 14 : 12, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function Input({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 5 }}>
        {label}{required && <span style={{ color: C.danger }}> *</span>}
      </label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '9px 12px', borderRadius: 8,
          border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text,
          background: '#fff', outline: 'none',
        }}
      />
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: C.card, borderRadius: 16,
        padding: '24px', width: '100%', maxWidth: 480, margin: '0 20px',
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(15,23,42,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: C.borderLight, border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 16, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title="Confirm action" onClose={onCancel}>
      <p style={{ color: C.sub, fontSize: 14, marginBottom: 20 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn label="Cancel" onClick={onCancel} />
        <Btn label="Confirm" onClick={onConfirm} variant="danger" size="md" />
      </div>
    </Modal>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtNu = (n: number) => `Nu ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Views ────────────────────────────────────────────────────────────────────

function DashboardView({ markets, users, payments, settlements }: {
  markets: Market[]; users: AdminUser[];
  payments: AdminPayment[]; settlements: AdminSettlement[];
}) {
  const openMarkets = markets.filter((m) => m.status === 'open').length;
  const totalPool = markets.reduce((a, m) => a + Number(m.totalPool), 0);
  const totalPayout = settlements.reduce((a, s) => a + Number(s.totalPaidOut), 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="Total Markets"     value={markets.length}  icon="📊" color={C.primary} />
        <StatCard label="Open Markets"      value={openMarkets}     icon="🟢" color={C.success} />
        <StatCard label="Total Pool"        value={fmtNu(totalPool)} icon="💰" color={C.warning} />
        <StatCard label="Registered Users"  value={users.length}    icon="👥" color={C.purple} />
        <StatCard label="Total Payments"    value={payments.length} icon="💳" color={C.teal} />
        <StatCard label="Total Paid Out"    value={fmtNu(totalPayout)} icon="🏆" color={C.success} />
      </div>

      <SectionHeader title="Recent Markets" />
      <Table
        cols={['Title', 'Status', 'Pool', 'Outcomes', 'Created']}
        rows={markets.slice(0, 8).map((m) => [
          <span style={{ fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{m.title}</span>,
          <Badge label={m.status} />,
          fmtNu(Number(m.totalPool)),
          m.outcomes.length,
          fmtDate(m.createdAt),
        ])}
      />
    </div>
  );
}

// ─── Create Market Modal ───────────────────────────────────────────────────────
function CreateMarketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [outcomesStr, setOutcomesStr] = useState('Yes\nNo');
  const [houseEdge, setHouseEdge] = useState('5');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const outcomes = outcomesStr.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!title.trim() || outcomes.length < 2) {
      setError('Title and at least 2 outcomes are required.'); return;
    }
    setLoading(true); setError('');
    try {
      const payload: CreateMarketPayload = {
        title: title.trim(),
        outcomes,
        houseEdgePct: parseFloat(houseEdge) || 5,
        ...(description.trim() && { description: description.trim() }),
        ...(opensAt && { opensAt: new Date(opensAt).toISOString() }),
        ...(closesAt && { closesAt: new Date(closesAt).toISOString() }),
      };
      await adminCreateMarket(payload);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create market');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create Market" onClose={onClose}>
      <Input label="Question / Title" value={title} onChange={setTitle} placeholder="Will Team A win?" required />
      <Input label="Description (optional)" value={description} onChange={setDescription} placeholder="Additional context…" />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 5 }}>
          Outcomes <span style={{ color: C.danger }}>*</span>
          <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>(one per line, min 2)</span>
        </label>
        <textarea
          value={outcomesStr}
          onChange={(e) => setOutcomesStr(e.target.value)}
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 12px',
            borderRadius: 8, border: `1.5px solid ${C.border}`,
            fontSize: 13, color: C.text, background: '#fff',
            outline: 'none', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
      </div>
      <Input label="House Edge (%)" value={houseEdge} onChange={setHouseEdge} type="number" placeholder="5" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Input label="Opens At" value={opensAt} onChange={setOpensAt} type="datetime-local" />
        <Input label="Closes At" value={closesAt} onChange={setClosesAt} type="datetime-local" />
      </div>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn label="Cancel" onClick={onClose} />
        <Btn label={loading ? 'Creating…' : 'Create Market'} onClick={handleCreate} variant="primary" size="md" disabled={loading} />
      </div>
    </Modal>
  );
}

// ─── Propose Modal ─────────────────────────────────────────────────────────────
function ProposeModal({ market, onClose, onProposed }: { market: Market; onClose: () => void; onProposed: () => void }) {
  const [proposedId, setProposedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePropose = async () => {
    if (!proposedId) { setError('Select a proposed winning outcome.'); return; }
    setLoading(true); setError('');
    try {
      await adminPropose(market.id, proposedId);
      onProposed(); onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to propose'); setLoading(false);
    }
  };

  return (
    <Modal title="Propose Outcome (Opens 24h Dispute Window)" onClose={onClose}>
      <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>{market.title}</p>
      <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#92400e', marginBottom: 16 }}>
        This will open a 24-hour dispute window. Bettors can submit bonds to flag disagreement. You make the final call after reviewing disputes.
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>Proposed Winning Outcome</label>
        {market.outcomes.map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${proposedId === o.id ? C.primary : C.border}`, background: proposedId === o.id ? C.primaryBg : '#f8fafc', cursor: 'pointer', marginBottom: 8 }}>
            <input type="radio" name="proposed" value={o.id} checked={proposedId === o.id} onChange={() => setProposedId(o.id)} />
            <span style={{ fontSize: 13, fontWeight: 600, color: proposedId === o.id ? C.primaryDark : C.text }}>{o.label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>Nu {Number(o.totalBetAmount).toLocaleString()}</span>
          </label>
        ))}
      </div>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn label="Cancel" onClick={onClose} />
        <Btn label={loading ? 'Opening window…' : 'Propose & Open Dispute Window'} onClick={handlePropose} variant="primary" size="md" disabled={loading} />
      </div>
    </Modal>
  );
}

// ─── Resolve Modal ─────────────────────────────────────────────────────────────
function ResolveModal({ market, onClose, onResolved }: { market: Market; onClose: () => void; onResolved: () => void }) {
  const [winnerId, setWinnerId] = useState(market.proposedOutcomeId ?? '');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGetMarketDisputes(market.id).then(setDisputes).catch(() => {});
  }, [market.id]);

  const handleResolve = async () => {
    if (!winnerId) { setError('Select a winning outcome.'); return; }
    setLoading(true); setError('');
    try {
      await adminResolve(market.id, winnerId);
      onResolved(); onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to resolve'); setLoading(false);
    }
  };

  return (
    <Modal title="Final Resolution" onClose={onClose}>
      <p style={{ fontSize: 14, color: C.sub, marginBottom: 16 }}>{market.title}</p>
      {disputes.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
            {disputes.length} Dispute{disputes.length !== 1 ? 's' : ''} Submitted
          </div>
          {disputes.map((d) => (
            <div key={d.id} style={{ fontSize: 12, color: '#78350f', marginBottom: 4 }}>
              Bond: {Number(d.bondAmount).toLocaleString()} credits
              {d.reason && <span style={{ color: '#92400e' }}> — "{d.reason}"</span>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 8 }}>Final Winning Outcome</label>
        {market.outcomes.map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${winnerId === o.id ? C.primary : C.border}`, background: winnerId === o.id ? C.primaryBg : '#f8fafc', cursor: 'pointer', marginBottom: 8 }}>
            <input type="radio" name="winner" value={o.id} checked={winnerId === o.id} onChange={() => setWinnerId(o.id)} />
            <span style={{ fontSize: 13, fontWeight: 600, color: winnerId === o.id ? C.primaryDark : C.text }}>{o.label}</span>
            {o.id === market.proposedOutcomeId && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Proposed</span>}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>Nu {Number(o.totalBetAmount).toLocaleString()}</span>
          </label>
        ))}
      </div>
      {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn label="Cancel" onClick={onClose} />
        <Btn label={loading ? 'Resolving…' : 'Resolve & Settle'} onClick={handleResolve} variant="primary" size="md" disabled={loading} />
      </div>
    </Modal>
  );
}

// ─── Markets View ─────────────────────────────────────────────────────────────
function MarketsView({ markets, onRefresh }: { markets: Market[]; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [proposing, setProposing] = useState<Market | null>(null);
  const [resolving, setResolving] = useState<Market | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const doAction = async (label: string, fn: () => Promise<unknown>) => {
    setActionLoading(label);
    try { await fn(); onRefresh(); }
    catch (e: any) { alert(e.message || 'Action failed'); }
    finally { setActionLoading(null); }
  };

  const NEXT_STATUS: Record<string, string | null> = {
    upcoming: 'open', open: 'closed', closed: null, resolving: null, resolved: null, settled: null, cancelled: null,
  };

  return (
    <div>
      <SectionHeader
        title={`Markets (${markets.length})`}
        action={<Btn label="+ Create Market" onClick={() => setShowCreate(true)} variant="primary" size="md" />}
      />
      <Table
        cols={['Title', 'Status', 'Pool', 'House %', 'Outcomes', 'Closes', 'Actions']}
        rows={markets.map((m) => {
          const next = NEXT_STATUS[m.status];
          return [
            <span style={{ fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{m.title}</span>,
            <Badge label={m.status} />,
            fmtNu(Number(m.totalPool)),
            `${m.houseEdgePct}%`,
            m.outcomes.map((o) => o.label).join(', ').slice(0, 30) + (m.outcomes.length > 2 ? '…' : ''),
            m.closesAt ? fmtDate(m.closesAt) : '—',
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {next && (
                <Btn
                  label={actionLoading === `${m.id}-next` ? '…' : `→ ${next}`}
                  onClick={() => setConfirm({ message: `Transition "${m.title}" to ${next}?`, action: () => doAction(`${m.id}-next`, () => adminTransition(m.id, next)) })}
                  variant="default"
                  disabled={actionLoading === `${m.id}-next`}
                />
              )}
              {m.status === 'closed' && (
                <Btn label="Propose" onClick={() => setProposing(m)} variant="primary" />
              )}
              {m.status === 'resolving' && (
                <Btn label="Final Resolve" onClick={() => setResolving(m)} variant="primary" />
              )}
              {(m.status === 'upcoming' || m.status === 'open' || m.status === 'resolving') && (
                <Btn
                  label={actionLoading === `${m.id}-cancel` ? '…' : 'Cancel'}
                  onClick={() => setConfirm({ message: `Cancel "${m.title}" and refund all bets?`, action: () => doAction(`${m.id}-cancel`, () => adminCancel(m.id)) })}
                  variant="danger"
                  disabled={actionLoading === `${m.id}-cancel`}
                />
              )}
              {(m.status === 'settled' || m.status === 'cancelled') && (
                <Btn
                  label={actionLoading === `${m.id}-del` ? '…' : 'Delete'}
                  onClick={() => setConfirm({ message: `Permanently delete "${m.title}"?`, action: () => doAction(`${m.id}-del`, () => adminDelete(m.id)) })}
                  variant="danger"
                  disabled={actionLoading === `${m.id}-del`}
                />
              )}
            </div>,
          ];
        })}
      />

      {showCreate && <CreateMarketModal onClose={() => setShowCreate(false)} onCreated={onRefresh} />}
      {proposing && <ProposeModal market={proposing} onClose={() => setProposing(null)} onProposed={onRefresh} />}
      {resolving && <ResolveModal market={resolving} onClose={() => setResolving(null)} onResolved={onRefresh} />}
      {confirm && <ConfirmModal message={confirm.message} onConfirm={() => { confirm.action(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─── Users View ───────────────────────────────────────────────────────────────
function UsersView({ users }: { users: AdminUser[] }) {
  return (
    <div>
      <SectionHeader title={`Users (${users.length})`} />
      <Table
        cols={['Name', 'Username', 'Telegram ID', 'Role', 'Joined']}
        rows={users.map((u) => [
          `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`,
          u.username ? `@${u.username}` : '—',
          u.telegramId,
          u.isAdmin ? <Badge label="admin" /> : <span style={{ color: C.muted, fontSize: 12 }}>user</span>,
          fmtDate(u.createdAt),
        ])}
      />
    </div>
  );
}

// ─── Payments View ────────────────────────────────────────────────────────────
function PaymentsView({ payments }: { payments: AdminPayment[] }) {
  return (
    <div>
      <SectionHeader title={`Payments (${payments.length})`} />
      <Table
        cols={['Date', 'Amount', 'Currency', 'Type', 'Method', 'Status', 'Description']}
        rows={payments.slice(0, 200).map((p) => [
          fmtDate(p.createdAt),
          <span style={{ fontWeight: 700, color: Number(p.amount) >= 0 ? C.success : C.danger }}>
            {Number(p.amount) >= 0 ? '+' : ''}{Number(p.amount).toFixed(2)}
          </span>,
          p.currency,
          <span style={{ fontSize: 11, color: C.sub }}>{p.type}</span>,
          p.method,
          <Badge label={p.status} />,
          <span style={{ color: C.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{p.description || '—'}</span>,
        ])}
      />
    </div>
  );
}

// ─── Settlements View ─────────────────────────────────────────────────────────
function SettlementsView({ settlements }: { settlements: AdminSettlement[] }) {
  return (
    <div>
      <SectionHeader title={`Settlements (${settlements.length})`} />
      <Table
        cols={['Market', 'Total Pool', 'House Cut', 'Payout Pool', 'Total Paid', 'Winners', 'Settled At']}
        rows={settlements.map((s) => [
          <span style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {(s.market as any)?.title ?? s.marketId.slice(0, 8)}
          </span>,
          fmtNu(Number(s.totalPool)),
          fmtNu(Number(s.houseAmount)),
          fmtNu(Number(s.payoutPool)),
          fmtNu(Number(s.totalPaidOut)),
          `${s.winningBets} / ${s.totalBets}`,
          fmtDate(s.settledAt),
        ])}
      />
    </div>
  );
}

// ─── Admin Login ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [cid, setCid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (cid.length !== 11) { setError('Enter your 11-digit CID'); return; }
    setLoading(true); setError('');
    try {
      const res = await loginWithDKBank(cid);
      if (!res.user.isAdmin) {
        setError('Access denied — admin account required.');
        setLoading(false); return;
      }
      onLogin(res.user);
    } catch (e: any) {
      setError(e.message || 'Login failed'); setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', colorScheme: 'light' }}>
      <div style={{ background: C.card, borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(15,23,42,0.10)', border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Tara Admin</div>
            <div style={{ fontSize: 12, color: C.muted }}>Restricted access</div>
          </div>
        </div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>CID Number</label>
        <input
          type="text" inputMode="numeric" value={cid} maxLength={11}
          onChange={(e) => { setCid(e.target.value.replace(/\D/g, '').slice(0, 11)); setError(''); }}
          placeholder="11-digit CID"
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '11px 14px',
            borderRadius: 9, border: `1.5px solid ${error ? '#fca5a5' : C.border}`,
            fontSize: 15, fontWeight: 600, color: C.text, background: '#f8fafc',
            outline: 'none', marginBottom: 14,
          }}
        />
        {error && <div style={{ fontSize: 13, color: C.danger, marginBottom: 12 }}>{error}</div>}
        <button
          onClick={handleLogin} disabled={loading || cid.length !== 11}
          style={{
            width: '100%', padding: '12px', borderRadius: 9, border: 'none',
            background: loading || cid.length !== 11 ? '#e2e8f0' : C.primary,
            color: loading || cid.length !== 11 ? C.muted : '#fff',
            fontSize: 14, fontWeight: 700, cursor: loading || cid.length !== 11 ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

type View = 'dashboard' | 'markets' | 'users' | 'payments' | 'settlements';

export function AdminPage() {
  const [adminUser, setAdminUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [settlements, setSettlements] = useState<AdminSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check existing session
  useEffect(() => {
    getMe()
      .then((u) => { if (u.isAdmin) setAdminUser(u); })
      .catch(() => {});
  }, []);

  const loadAll = useCallback(async () => {
    if (!adminUser) return;
    setLoading(true);
    try {
      const [m, u, p, s] = await Promise.all([
        adminGetMarkets(), adminGetUsers(), adminGetPayments(), adminGetSettlements(),
      ]);
      setMarkets(m); setUsers(u); setPayments(p); setSettlements(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [adminUser]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!adminUser) return <AdminLogin onLogin={setAdminUser} />;

  const NAV: { view: View; icon: string; label: string }[] = [
    { view: 'dashboard',   icon: '📊', label: 'Dashboard' },
    { view: 'markets',     icon: '🏷️', label: 'Markets' },
    { view: 'users',       icon: '👥', label: 'Users' },
    { view: 'payments',    icon: '💳', label: 'Payments' },
    { view: 'settlements', icon: '🏆', label: 'Settlements' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", colorScheme: 'light' }}>

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 220 : 0, flexShrink: 0, overflow: 'hidden',
        background: C.sidebar, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛡️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Tara Admin</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>{adminUser.firstName}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((n) => (
            <NavItem key={n.view} icon={n.icon} label={n.label} active={view === n.view} onClick={() => setView(n.view)} />
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 12px 20px', borderTop: `1px solid ${C.borderLight}` }}>
          <button
            onClick={() => { setAdminUser(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', border: 'none', borderRadius: 8, background: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontSize: 14 }}>↩</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 56, background: C.card, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
          position: 'sticky', top: 0, zIndex: 10,
          boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
        }}>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 20, padding: 0, display: 'flex' }}
          >☰</button>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {NAV.find((n) => n.view === view)?.label}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {loading && <span style={{ fontSize: 12, color: C.muted }}>Refreshing…</span>}
            <button
              onClick={loadAll}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.borderLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.sub }}
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {view === 'dashboard'   && <DashboardView   markets={markets} users={users} payments={payments} settlements={settlements} />}
          {view === 'markets'     && <MarketsView     markets={markets} onRefresh={loadAll} />}
          {view === 'users'       && <UsersView       users={users} />}
          {view === 'payments'    && <PaymentsView    payments={payments} />}
          {view === 'settlements' && <SettlementsView settlements={settlements} />}
        </main>
      </div>
    </div>
  );
}
