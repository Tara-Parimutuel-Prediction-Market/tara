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
import { IsNotEmpty, IsString, IsUUID, Length } from "class-validator";
export class ValidateOtpDto {
}
_ts_decorate([
    ApiProperty({
        description: "Transaction ID for OTP validation",
        example: "123e4567-e89b-12d3-a456-426614174000"
    }),
    IsUUID(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], ValidateOtpDto.prototype, "transactionId", void 0);
_ts_decorate([
    ApiProperty({
        description: "6-digit OTP received via SMS/Push notification",
        example: "123456",
        minLength: 6,
        maxLength: 6
    }),
    IsString(),
    Length(6, 6, {
        message: "OTP must be exactly 6 digits"
    }),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], ValidateOtpDto.prototype, "otp", void 0);

//# sourceMappingURL=validate-otp.dto.js.map