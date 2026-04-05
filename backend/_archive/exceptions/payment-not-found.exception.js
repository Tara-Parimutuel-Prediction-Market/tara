import { NotFoundException } from "@nestjs/common";
export class PaymentNotFoundException extends NotFoundException {
    constructor(paymentId){
        super(`Payment with ID ${paymentId} not found`);
    }
}

//# sourceMappingURL=payment-not-found.exception.js.map