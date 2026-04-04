// ─────────────────────────────────────────────────────────────────────────────
// API client — all requests to the NestJS backend go through here
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Store the JWT in sessionStorage — survives page navigation, cleared on tab close
let _token: string | null = sessionStorage.getItem("tara_token");

export function setToken(token: string) {
  _token = token;
  sessionStorage.setItem("tara_token", token);
}

export function getToken(): string | null {
  return _token;
}

export function clearToken() {
  _token = null;
  sessionStorage.removeItem("tara_token");
}

// Decode a JWT payload without a library — returns null if malformed
export function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// Returns true if the stored token exists and has not expired
export function isTokenValid(): boolean {
  const token = getToken();
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  // exp is in seconds; give a 30-second buffer
  return payload.exp * 1000 > Date.now() + 30_000;
}

// Base fetch wrapper — automatically attaches Bearer token
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (_token) {
    headers["Authorization"] = `Bearer ${_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token rejected by server — clear it and notify the app
    clearToken();
    window.dispatchEvent(new Event("tara:unauthorized"));
    const err = await res.json().catch(() => ({ message: "Unauthorized" }));
    throw new Error(err.message || "Unauthorized");
  }

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
  creditsBalance?: number;
  createdAt?: string;
  // DK Bank linking fields
  dkCid?: string | null;
  dkAccountName?: string | null;
  telegramLinkedAt?: string | null;
  // Boolean flags — hashes are never sent to the client
  isDkPhoneLinked?: boolean;
  isPhoneVerified?: boolean;
  // Reputation
  reputationScore?: number | null;
  reputationTier?: string;
  totalPredictions?: number;
  correctPredictions?: number;
  categoryScores?: Record<string, { correct: number; total: number }> | null;
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

/**
 * Link a DK Bank CID to the currently authenticated Telegram user.
 * Requires a valid JWT. Stores dkPhoneHash on the user row so that
 * the bot's /verify phone check can compare Telegram phone == DK phone.
 */
export async function linkDKBank(cid: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/link-dkbank", {
    method: "POST",
    body: JSON.stringify({ cid }),
  });
}

// ─── Markets ─────────────────────────────────────────────────────────────────

export interface Outcome {
  id: string;
  label: string;
  totalBetAmount: string;
  currentOdds: string;
  lmsrProbability?: number;
  reputationSignal?: number | null; // reputation-weighted probability (null = not enough data)
  isWinner: boolean;
  marketId: string;
}

export interface Market {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status:
    | "upcoming"
    | "open"
    | "closed"
    | "resolving"
    | "resolved"
    | "settled"
    | "cancelled";
  mechanism: "parimutuel";
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
  bondAmount?: number;
  paymentId?: string;
  reason?: string;
}

export function getDisputes(marketId: string): Promise<Dispute[]> {
  return request<Dispute[]>(`/markets/${marketId}/disputes`);
}

export function submitDispute(
  marketId: string,
  payload: SubmitDisputePayload,
): Promise<Dispute> {
  return request<Dispute>(`/markets/${marketId}/disputes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMarkets(q?: string): Promise<Market[]> {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return request<Market[]>(`/markets${qs}`);
}

export function getMarket(id: string): Promise<Market> {
  return request<Market>(`/markets/${id}`);
}

// ─── Bets ─────────────────────────────────────────────────────────────────────

export interface PlaceBetPayload {
  outcomeId: string;
  amount: number;
}

export function placeBet(marketId: string, payload: PlaceBetPayload) {
  return request(`/markets/${marketId}/bets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface Bet {
  id: string;
  amount: number;
  status: "pending" | "won" | "lost" | "refunded";
  oddsAtPlacement: number | null;
  payout: number | null;
  placedAt: string;
  marketId: string;
  outcomeId: string;
  market?: Market;
  outcome?: Outcome;
}

export interface Transaction {
  id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "bet_placed"
    | "bet_payout"
    | "refund"
    | "dispute_bond"
    | "dispute_refund";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  betId: string | null;
  paymentId: string | null;
  createdAt: string;
}

export function getMyBets(status?: Bet["status"]): Promise<Bet[]> {
  const qs = status ? `?status=${status}` : "";
  return request<Bet[]>(`/users/me/bets${qs}`);
}

export function getMyResults(): Promise<Bet[]> {
  return request<Bet[]>("/users/me/results");
}

// ─── User ─────────────────────────────────────────────────────────────────────

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/users/me");
}

export function getMyTransactions(
  type?: Transaction["type"],
): Promise<Transaction[]> {
  const qs = type ? `?type=${type}` : "";
  return request<Transaction[]>(`/users/me/transactions${qs}`);
}

// ─── TON Wallet Betting ──────────────────────────────────────────────────────

export interface WalletBetPayload {
  outcomeId: string;
  amount: number; // in TON
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
