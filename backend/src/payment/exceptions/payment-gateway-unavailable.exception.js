import { ServiceUnavailableException } from "@nestjs/common";
/**
 * Payment Gateway Unavailable Exception
 *
 * Thrown when the DK payment gateway is down or unreachable.
 * Corresponds to HTTP 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout.
 *
 * This indicates the external payment system is having issues,
 * not our application. Users should retry later.
 */ export class PaymentGatewayUnavailableException extends ServiceUnavailableException {
    constructor(message){
        super(message || "Payment gateway is temporarily unavailable. Please try again in a few moments. " + "If the issue persists, contact support.");
    }
}

//# sourceMappingURL=payment-gateway-unavailable.exception.js.map