// ─────────────────────────────────────────────────────────────────────────────
// API client — all requests to the NestJS backend go through here
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Store the JWT in memory (survives page navigation, cleared on close)
let _token: string | null = localStorage.getItem("tara_token");

export function setToken(token: string) {
  _token = token;
  localStorage.setItem("tara_token", token);
}

export function getToken(): string | null {
  return _token;
}

export function clearToken() {
  _token = null;
  localStorage.removeItem("tara_token");
}

// Base fetch wrapper — automatically attaches Bearer token
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  isAdmin: boolean;
  balance: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/** Login / register using Telegram initData (HMAC validated on server) */
export async function loginWithTelegram(
  initData: string,
): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData }),
  });
  setToken(result.token);
  return result;
}

/** Login / register using DK Bank CID — for PWA users without Telegram */
export async function loginWithDKBank(cid: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>("/auth/dkbank", {
    method: "POST",
    body: JSON.stringify({ cid }),
  });
  setToken(result.token);
  return result;
}

// ─── Markets ─────────────────────────────────────────────────────────────────

export interface Outcome {
  id: string;
  label: string;
  totalBetAmount: string;
  currentOdds: string;
  lmsrProbability?: number; // LMSR probability (0-1)
  isWinner: boolean;
  marketId: string;
}

export interface Market {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status: "upcoming" | "open" | "closed" | "resolving" | "resolved" | "settled" | "cancelled";
  mechanism: "parimutuel" | "scpm";
  liquidityParam: string;
  totalPool: string;
  houseEdgePct: string;
  opensAt: string | null;
  closesAt: string | null;
  resolvedAt: string | null;
  proposedOutcomeId: string | null;
  disputeDeadlineAt: string | null;
  createdAt: string;
  outcomes: Outcome[];
}

export interface Dispute {
  id: string;
  userId: string;
  marketId: string;
  bondAmount: string;
  reason: string | null;
  bondRefunded: boolean;
  createdAt: string;
}

export interface SubmitDisputePayload {
  bondAmount: number;
  reason?: string;
}

export function getDisputes(marketId: string): Promise<Dispute[]> {
  return request<Dispute[]>(`/markets/${marketId}/disputes`);
}

export function submitDispute(marketId: string, payload: SubmitDisputePayload): Promise<Dispute> {
  return request<Dispute>(`/markets/${marketId}/disputes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMarkets(): Promise<Market[]> {
  return request<Market[]>("/markets");
}

export function getMarket(id: string): Promise<Market> {
  return request<Market>(`/markets/${id}`);
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export interface PlaceBetPayload {
  outcomeId: string;
  amount?: number;
  maxShares?: number;
  limitPrice?: number;
}

export function placeBet(marketId: string, payload: PlaceBetPayload) {
  return request(`/markets/${marketId}/bets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyBets() {
  return request("/bets/my");
}

// ─── User ─────────────────────────────────────────────────────────────────────

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/users/me");
}

export function getMyTransactions() {
  return request("/users/me/transactions");
}

// ─── TON Wallet Betting ──────────────────────────────────────────────────────

export interface WalletBetPayload {
  outcomeId: string;
  amount: number; // in TON
  maxShares?: number;
  limitPrice?: number;
  walletAddress: string;
  txHash?: string; // proof of payment
}

/** Place a bet using TON wallet (no login required) */
export async function placeBetWithWallet(
  marketId: string,
  payload: WalletBetPayload,
) {
  // No auth token needed — wallet address is the identifier
  const res = await fetch(`${API_URL}/markets/${marketId}/bets/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Get bets by wallet address (no login required) */
export function getBetsByWallet(walletAddress: string) {
  return fetch(`${API_URL}/bets/wallet/${walletAddress}`).then((r) =>
    r.ok ? r.json() : Promise.reject(r.statusText),
  );
}
