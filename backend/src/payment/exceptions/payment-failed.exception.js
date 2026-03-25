import { BadRequestException } from "@nestjs/common";
export class PaymentFailedException extends BadRequestException {
    constructor(reason){
        super(`error.paymentFailed`, reason);
    }
}

//# sourceMappingURL=payment-failed.exception.js.map