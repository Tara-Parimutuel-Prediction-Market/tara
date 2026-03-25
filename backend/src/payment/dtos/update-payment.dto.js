function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PaymentStatus } from "../../../constants/payment-status.js";
import { StringFieldOptional } from "../../../decorators/field.decorators.js";
export class UpdatePaymentDto {
}
_ts_decorate([
    ApiPropertyOptional({
        enum: PaymentStatus
    }),
    IsEnum(PaymentStatus),
    IsOptional(),
    _ts_metadata("design:type", typeof PaymentStatus === "undefined" ? Object : PaymentStatus)
], UpdatePaymentDto.prototype, "status", void 0);
_ts_decorate([
    StringFieldOptional({
        maxLength: 255
    }),
    _ts_metadata("design:type", String)
], UpdatePaymentDto.prototype, "transactionId", void 0);
_ts_decorate([
    StringFieldOptional({
        maxLength: 255
    }),
    _ts_metadata("design:type", String)
], UpdatePaymentDto.prototype, "gatewayReference", void 0);
_ts_decorate([
    StringFieldOptional({
        maxLength: 500
    }),
    _ts_metadata("design:type", String)
], UpdatePaymentDto.prototype, "description", void 0);
_ts_decorate([
    StringFieldOptional({
        maxLength: 1000
    }),
    _ts_metadata("design:type", String)
], UpdatePaymentDto.prototype, "errorMessage", void 0);

//# sourceMappingURL=update-payment.dto.js.map