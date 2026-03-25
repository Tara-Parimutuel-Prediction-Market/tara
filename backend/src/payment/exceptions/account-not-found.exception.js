import { NotFoundException } from "@nestjs/common";
export class AccountNotFoundException extends NotFoundException {
    constructor(identifier){
        super(`error.accountNotFound`, `Account not found for: ${identifier}`);
    }
}

//# sourceMappingURL=account-not-found.exception.js.map