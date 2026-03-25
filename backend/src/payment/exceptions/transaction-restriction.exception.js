import { BadRequestException } from "@nestjs/common";
/**
 * Exception thrown when a payment fails due to transaction restrictions
 * set by the user's bank (e.g., daily spending limit exceeded).
 *
 * This corresponds to DK Bank response code 2008.
 */ export class TransactionRestrictionException extends BadRequestException {
    constructor(responseDescription){
        const message = responseDescription || "Your payment was declined due to transaction restrictions on your bank account. " + "Please check your bank's spending limits or contact your bank for assistance.";
        super(message);
    }
}

//# sourceMappingURL=transaction-restriction.exception.js.map