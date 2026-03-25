import { HttpException, HttpStatus } from "@nestjs/common";
export class OtpException extends HttpException {
    constructor(message, errorCode){
        super({
            message,
            error: "Bad Request",
            statusCode: 4001,
            errorCode
        }, HttpStatus.BAD_REQUEST);
    }
}

//# sourceMappingURL=otp.exception.js.map