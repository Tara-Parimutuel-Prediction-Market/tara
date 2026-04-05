import { HttpException, HttpStatus } from "@nestjs/common";
export class DKGatewayException extends HttpException {
    constructor(responseCode, responseMessage, responseDescription){
        // Map DK response codes to HTTP status codes
        const httpStatus = DKGatewayException.mapToHttpStatus(responseCode);
        super({
            response_code: responseCode,
            response_message: responseMessage,
            response_description: responseDescription || responseMessage,
            statusCode: parseInt(responseCode)
        }, httpStatus), this.responseCode = responseCode, this.responseMessage = responseMessage, this.responseDescription = responseDescription;
    }
    static mapToHttpStatus(responseCode) {
        const code = parseInt(responseCode);
        // Success codes
        if (code === 0) return HttpStatus.OK;
        // Missing/Not Found codes (3xxx)
        if (code >= 3000 && code < 4000) return HttpStatus.NOT_FOUND;
        // Client error codes (4xxx)
        if (code >= 4000 && code < 5000) return HttpStatus.BAD_REQUEST;
        // Special case: Code 2008 - Transaction restriction (user's bank spending limit)
        // This is a client-side error, not a server error
        if (code === 2008) {
            return HttpStatus.BAD_REQUEST;
        }
        // Server/Exception codes (5xxx) or Transaction failure codes (2xxx)
        if (code >= 5000 || code >= 2000 && code < 3000) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
        // Default to bad request
        return HttpStatus.BAD_REQUEST;
    }
}

//# sourceMappingURL=dk-gateway.exception.js.map