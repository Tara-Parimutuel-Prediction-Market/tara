function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AbstractDto } from "../../../common/dto/abstract.dto.js";
import { PaymentStatus } from "../../../constants/payment-status.js";
export class PaymentDto extends AbstractDto {
    constructor(payment){
        super(payment);
        this.amount = payment.amount;
        this.currency = payment.currency;
        this.status = payment.status;
        this.transactionId = payment.transactionId;
        this.gatewayReference = payment.gatewayReference;
        this.description = payment.description;
        this.errorMessage = payment.errorMessage;
        this.userId = payment.userId;
        this.poolId = payment.poolId;
    }
}
_ts_decorate([
    ApiProperty({
        description: "Payment amount"
    }),
    _ts_metadata("design:type", Number)
], PaymentDto.prototype, "amount", void 0);
_ts_decorate([
    ApiProperty({
        description: "Currency code",
        example: "BTN"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "currency", void 0);
_ts_decorate([
    ApiProperty({
        enum: PaymentStatus,
        description: "Payment status"
    }),
    _ts_metadata("design:type", typeof PaymentStatus === "undefined" ? Object : PaymentStatus)
], PaymentDto.prototype, "status", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Transaction ID from gateway"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "transactionId", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Gateway reference number"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "gatewayReference", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Payment description"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "description", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Error message if payment failed"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "errorMessage", void 0);
_ts_decorate([
    ApiProperty({
        description: "User ID who made the payment"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "userId", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Associated pool ID"
    }),
    _ts_metadata("design:type", String)
], PaymentDto.prototype, "poolId", void 0);

//# sourceMappingURL=payment.dto.js.map