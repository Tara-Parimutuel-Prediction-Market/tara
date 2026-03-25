import { BadRequestException } from "@nestjs/common";
export class InsufficientBalanceException extends BadRequestException {
    constructor(){
        super("error.insufficientBalance", "Insufficient balance for this transaction");
    }
}

//# sourceMappingURL=insufficient-balance.exception.js.map