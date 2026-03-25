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
 * Validate Bhutanese phone number
 * Format: +975 17XXXXXX or +975 77XXXXXX
 */
export function validateBhutanesePhone(phone: string): boolean {
  const cleaned = phone.replace(/\s+/g, "");
  const regex = /^\+975[17]\d{7}$/;
  return regex.test(cleaned);
}
