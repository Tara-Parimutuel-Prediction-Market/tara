import { request } from "./client";
import type { 
  DKBankPaymentRequest, 
  PaymentResponse, 
  PaymentStatus
} from "@/types/payment";

/**
 * DK Bank (Druk PNB Bank) Payment Integration
 * 
 * This module handles BTN (Bhutanese Ngultrum) payments via DK Bank
 * for Bhutanese users betting on archery matches.
 * 
 * INTEGRATES WITH BACKEND PAYMENT SERVICE
 */

/**
 * Initiate a payment via DK Bank through backend
 * 
 * This calls the backend payment service which handles
 * the actual DK Bank integration
 */
export async function initiateDKBankPayment(
  payment: DKBankPaymentRequest,
): Promise<PaymentResponse> {
  try {
    const response = await request<PaymentResponse>("/payments/dkbank/initiate", {
      method: "POST",
      body: JSON.stringify(payment),
    });
    
    return response;
  } catch (error: any) {
    throw new Error(error.message || "DK Bank payment initiation failed");
  }
}

/**
 * Step 2: Submit OTP to confirm a DK Bank payment
 */
export async function confirmDKBankPayment(
  paymentId: string,
  otp: string,
): Promise<PaymentResponse> {
  try {
    return await request<PaymentResponse>("/payments/dkbank/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentId, otp }),
    });
  } catch (error: any) {
    throw new Error(error.message || "DK Bank payment confirmation failed");
  }
}

/**
 * Check payment status through backend
 */
export async function checkDKBankPaymentStatus(
  paymentId: string,
): Promise<PaymentStatus> {
  try {
    const response = await request<PaymentStatus>(`/payments/dkbank/status/${paymentId}`);
    return response;
  } catch (error: any) {
    throw new Error(error.message || "Failed to check payment status");
  }
}

/**
 * Format BTN currency for display
 */
export function formatBTN(amount: number): string {
  return `Nu. ${amount.toLocaleString("en-BT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Validate Bhutanese CID number
 * Format: exactly 11 numeric digits
 */
export function validateCID(cid: string): boolean {
  const cleaned = cid.replace(/\s+/g, "");
  return /^\d{11}$/.test(cleaned);
}
