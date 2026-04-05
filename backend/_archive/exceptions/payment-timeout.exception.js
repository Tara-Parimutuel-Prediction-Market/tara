import { RequestTimeoutException } from "@nestjs/common";
export class PaymentTimeoutException extends RequestTimeoutException {
    constructor(message){
        super(message || "Payment request timed out. Please check your connection and try again. If amount was deducted, it will be refunded automatically.");
    }
}

//# sourceMappingURL=payment-timeout.exception.js.map