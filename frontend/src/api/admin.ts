import { request } from './client';
import type { Market, Dispute } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export interface AdminPayment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  type: string;
  method: string;
  status: string;
  description: string | null;
  referenceId: string | null;
  createdAt: string;
  user?: AdminUser;
}

export interface AdminSettlement {
  id: string;
  marketId: string;
  winningOutcomeId: string;
  totalBets: number;
  winningBets: number;
  totalPool: number;
  houseAmount: number;
  payoutPool: number;
  totalPaidOut: number;
  settledAt: string;
  market?: Market;
}

export interface CreateMarketPayload {
  title: string;
  description?: string;
  outcomes: string[];
  houseEdgePct?: number;
  opensAt?: string;
  closesAt?: string;
}

// ─── Markets ─────────────────────────────────────────────────────────────────

export const adminGetMarkets = () => request<Market[]>('/admin/markets');
export const adminCreateMarket = (payload: CreateMarketPayload) =>
  request<Market>('/admin/markets', { method: 'POST', body: JSON.stringify(payload) });
export const adminTransition = (id: string, status: string) =>
  request<Market>(`/admin/markets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const adminPropose = (id: string, proposedOutcomeId: string) =>
  request<Market>(`/admin/markets/${id}/propose`, { method: 'POST', body: JSON.stringify({ proposedOutcomeId }) });
export const adminResolve = (id: string, winningOutcomeId: string) =>
  request<Market>(`/admin/markets/${id}/resolve`, { method: 'POST', body: JSON.stringify({ winningOutcomeId }) });
export const adminGetMarketDisputes = (id: string) =>
  request<import('./client').Dispute[]>(`/admin/markets/${id}/disputes`);
export const adminCancel = (id: string) =>
  request(`/admin/markets/${id}/cancel`, { method: 'POST' });
export const adminDelete = (id: string) =>
  request(`/admin/markets/${id}`, { method: 'DELETE' });

// ─── Users / Payments / Settlements / Disputes ───────────────────────────────

export const adminGetUsers = () => request<AdminUser[]>('/admin/users');
export const adminGetPayments = () => request<AdminPayment[]>('/admin/payments');
export const adminGetSettlements = () => request<AdminSettlement[]>('/admin/settlements');
export const adminGetAllDisputes = () => request<Dispute[]>('/admin/disputes');

export type { Dispute };
