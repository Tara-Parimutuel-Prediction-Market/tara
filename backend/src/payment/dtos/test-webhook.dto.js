function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsString } from "class-validator";
export class TestWebhookDto {
}
_ts_decorate([
    ApiProperty({
        description: "Inquiry ID from the payment transaction",
        example: "IN5D28B9114B1D4DC5BCBFDE04CD6973A2"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TestWebhookDto.prototype, "inquiry_id", void 0);
_ts_decorate([
    ApiProperty({
        description: "Payment amount",
        example: 100.50
    }),
    IsNumber(),
    IsNotEmpty(),
    _ts_metadata("design:type", Number)
], TestWebhookDto.prototype, "amount", void 0);
_ts_decorate([
    ApiProperty({
        description: "Source account number",
        example: "100100148337"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TestWebhookDto.prototype, "sourceAccountNumber", void 0);
_ts_decorate([
    ApiProperty({
        description: "Source account holder name",
        example: "John Doe"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TestWebhookDto.prototype, "sourceAccountName", void 0);
_ts_decorate([
    ApiProperty({
        description: "Payment description",
        example: "Lottery pool entry payment"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TestWebhookDto.prototype, "description", void 0);

//# sourceMappingURL=test-webhook.dto.js.map