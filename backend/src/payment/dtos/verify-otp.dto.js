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
import { IsNotEmpty, IsString, Length } from "class-validator";
export class VerifyOtpDto {
}
_ts_decorate([
    ApiProperty({
        description: "Transaction ID for which OTP needs to be verified",
        example: "123e4567-e89b-12d3-a456-426614174000"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], VerifyOtpDto.prototype, "transactionId", void 0);
_ts_decorate([
    ApiProperty({
        description: "6-digit OTP code",
        example: "123456",
        minLength: 6,
        maxLength: 6
    }),
    IsString(),
    IsNotEmpty(),
    Length(6, 6, {
        message: "OTP must be exactly 6 digits"
    }),
    _ts_metadata("design:type", String)
], VerifyOtpDto.prototype, "otp", void 0);

//# sourceMappingURL=verify-otp.dto.js.map