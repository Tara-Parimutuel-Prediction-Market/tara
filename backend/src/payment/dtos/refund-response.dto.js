function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { BooleanField } from "../../../decorators/field.decorators.js";
import { NumberField } from "../../../decorators/field.decorators.js";
import { StringField } from "../../../decorators/field.decorators.js";
import { ClassField } from "../../../decorators/field.decorators.js";
export class RefundDetailDto {
}
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], RefundDetailDto.prototype, "transactionId", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], RefundDetailDto.prototype, "cidNo", void 0);
_ts_decorate([
    NumberField(),
    _ts_metadata("design:type", Number)
], RefundDetailDto.prototype, "amount", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], RefundDetailDto.prototype, "status", void 0);
export class RefundResponseDto {
}
_ts_decorate([
    BooleanField(),
    _ts_metadata("design:type", Boolean)
], RefundResponseDto.prototype, "success", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], RefundResponseDto.prototype, "poolId", void 0);
_ts_decorate([
    NumberField(),
    _ts_metadata("design:type", Number)
], RefundResponseDto.prototype, "totalRefundAmount", void 0);
_ts_decorate([
    NumberField(),
    _ts_metadata("design:type", Number)
], RefundResponseDto.prototype, "refundCount", void 0);
_ts_decorate([
    ClassField(()=>RefundDetailDto, {
        isArray: true
    }),
    _ts_metadata("design:type", Array)
], RefundResponseDto.prototype, "refundDetails", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], RefundResponseDto.prototype, "message", void 0);

//# sourceMappingURL=refund-response.dto.js.map