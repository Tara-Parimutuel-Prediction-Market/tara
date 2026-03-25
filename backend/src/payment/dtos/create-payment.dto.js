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
import { NumberField } from "../../../decorators/field.decorators.js";
import { StringFieldOptional } from "../../../decorators/field.decorators.js";
import { UUIDField } from "../../../decorators/field.decorators.js";
export class CreatePaymentDto {
}
_ts_decorate([
    ApiProperty({
        description: "Payment amount",
        minimum: 0
    }),
    NumberField({
        min: 0
    }),
    _ts_metadata("design:type", Number)
], CreatePaymentDto.prototype, "amount", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Currency code",
        example: "BTN",
        default: "BTN"
    }),
    StringFieldOptional({
        maxLength: 3
    }),
    _ts_metadata("design:type", String)
], CreatePaymentDto.prototype, "currency", void 0);
_ts_decorate([
    StringFieldOptional({
        maxLength: 500
    }),
    _ts_metadata("design:type", String)
], CreatePaymentDto.prototype, "description", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Associated pool ID"
    }),
    UUIDField({
        required: false
    }),
    _ts_metadata("design:type", String)
], CreatePaymentDto.prototype, "poolId", void 0);

//# sourceMappingURL=create-payment.dto.js.map