/**
 * Payment System Types
 * Supports DK Bank (BTN) and TON payments for Tara Platform
 */

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'dkbank' | 'ton' | 'credits';
  currency: 'BTN' | 'TON' | 'CREDITS';
  enabled: boolean;
  icon?: string;
  minAmount: number;
  maxAmount?: number;
}

export interface PaymentRequest {
  amount: number;
  currency: 'BTN' | 'TON' | 'CREDITS';
  method: PaymentMethod;
  description: string;
  metadata?: Record<string, any>;
}

export interface DKBankPaymentRequest {
  amount: number; // in BTN
  customerPhone: string;
  customerName?: string;
  description: string;
  merchantTxnId: string;
}

export interface DKBankResponse {
  success: boolean;
  txnId?: string;
  status?: 'pending' | 'success' | 'failed';
  message?: string;
  paymentUrl?: string;
  qrCode?: string;
}

export interface TONPaymentRequest {
  amount: number; // in TON
  destinationAddress: string;
  comment?: string;
}

export interface TONPaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: 'pending' | 'success' | 'failed';
  message?: string;
  paymentLink?: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  status: 'pending' | 'success' | 'failed';
  amount: number;
  currency: string;
  method: string;
  message?: string;
  paymentUrl?: string;
  qrCode?: string;
  timestamp: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  method: string;
  confirmedAt?: string;
  failureReason?: string;
}

export interface UserBalance {
  btn: number;
  ton: number;
  credits: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'winnings';
  amount: number;
  currency: string;
  method: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

export interface BetSlip {
  marketId: string;
  marketTitle: string;
  outcomes: Array<{
    id: string;
    label: string;
    amount: number;
    odds: number;
  }>;
  totalAmount: number;
  currency: string;
  potentialWinnings: number;
}

export interface PaymentError {
  code: string;
  message: string;
  details?: any;
}
