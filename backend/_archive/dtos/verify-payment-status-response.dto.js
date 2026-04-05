function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { ClassField } from "../../../decorators/field.decorators.js";
import { StringField } from "../../../decorators/field.decorators.js";
import { StringFieldOptional } from "../../../decorators/field.decorators.js";
export class PaymentStatusMeta {
}
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusMeta.prototype, "request_id", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusMeta.prototype, "source_app", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusMeta.prototype, "contract_number", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusMeta.prototype, "srn", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusMeta.prototype, "msg_type", void 0);
export class PaymentStatusData {
}
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "status", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "status_desc", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "debit_account", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "txn_ts", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "credit_account", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "amount", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], PaymentStatusData.prototype, "srn", void 0);
export class PaymentStatusResponse {
}
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusResponse.prototype, "response_code", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], PaymentStatusResponse.prototype, "response_status", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], PaymentStatusResponse.prototype, "response_detail", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], PaymentStatusResponse.prototype, "response_description", void 0);
_ts_decorate([
    ClassField(()=>PaymentStatusMeta, {
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], PaymentStatusResponse.prototype, "meta_info", void 0);
_ts_decorate([
    ClassField(()=>PaymentStatusData, {
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], PaymentStatusResponse.prototype, "status", void 0);
_ts_decorate([
    ClassField(()=>PaymentStatusData, {
        nullable: true,
        isArray: true
    }),
    _ts_metadata("design:type", Object)
], PaymentStatusResponse.prototype, "response_data", void 0);
export class VerifyPaymentStatusResponseDto {
}
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "account_number", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "transaction_id", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "request_id", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "bene_account_number", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "status_code", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "status_message", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "status_description", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "payment_status", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "payment_status_desc", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "amount", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "debit_account", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "credit_account", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], VerifyPaymentStatusResponseDto.prototype, "transaction_timestamp", void 0);

//# sourceMappingURL=verify-payment-status-response.dto.js.map