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
export class GenerateOtpResponseDto {
}
_ts_decorate([
    ApiProperty({
        description: "Whether OTP generation was successful",
        example: true
    }),
    _ts_metadata("design:type", Boolean)
], GenerateOtpResponseDto.prototype, "success", void 0);
_ts_decorate([
    ApiProperty({
        description: "Success message",
        example: "OTP sent successfully via push and SMS"
    }),
    _ts_metadata("design:type", String)
], GenerateOtpResponseDto.prototype, "message", void 0);
_ts_decorate([
    ApiProperty({
        description: "OTP expiry time in minutes",
        example: 2
    }),
    _ts_metadata("design:type", Number)
], GenerateOtpResponseDto.prototype, "expiryMinutes", void 0);
_ts_decorate([
    ApiProperty({
        description: "Error message if generation failed",
        example: "Failed to send OTP",
        required: false
    }),
    _ts_metadata("design:type", String)
], GenerateOtpResponseDto.prototype, "error", void 0);

//# sourceMappingURL=generate-otp-response.dto.js.map