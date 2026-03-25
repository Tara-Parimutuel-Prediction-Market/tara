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
export class ClientAccountData {
}
_ts_decorate([
    ApiProperty({
        description: "National ID (CID)",
        example: "10705001283"
    }),
    _ts_metadata("design:type", String)
], ClientAccountData.prototype, "national_id", void 0);
_ts_decorate([
    ApiProperty({
        description: "Account number",
        example: "100100366202"
    }),
    _ts_metadata("design:type", String)
], ClientAccountData.prototype, "account_number", void 0);
_ts_decorate([
    ApiProperty({
        description: "Citizen country",
        example: "Bhutan"
    }),
    _ts_metadata("design:type", String)
], ClientAccountData.prototype, "citizen_country", void 0);
_ts_decorate([
    ApiProperty({
        description: "First name",
        example: "Sangay"
    }),
    _ts_metadata("design:type", String)
], ClientAccountData.prototype, "first_name", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Middle name",
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], ClientAccountData.prototype, "middle_name", void 0);
_ts_decorate([
    ApiProperty({
        description: "Last name",
        example: "Wangdi"
    }),
    _ts_metadata("design:type", String)
], ClientAccountData.prototype, "last_name", void 0);
_ts_decorate([
    ApiPropertyOptional({
        description: "Phone number",
        example: "17123456"
    }),
    _ts_metadata("design:type", String)
], ClientAccountData.prototype, "phone_number", void 0);
export class ClientInquiryResponseDto {
}
_ts_decorate([
    ApiProperty({
        description: "Response code",
        example: "0000"
    }),
    _ts_metadata("design:type", String)
], ClientInquiryResponseDto.prototype, "response_code", void 0);
_ts_decorate([
    ApiProperty({
        description: "Response message",
        example: "Success"
    }),
    _ts_metadata("design:type", String)
], ClientInquiryResponseDto.prototype, "response_message", void 0);
_ts_decorate([
    ApiProperty({
        description: "Response description",
        example: "Record of Customer Details"
    }),
    _ts_metadata("design:type", String)
], ClientInquiryResponseDto.prototype, "response_description", void 0);
_ts_decorate([
    ApiProperty({
        type: [
            ClientAccountData
        ],
        description: "Customer account details"
    }),
    _ts_metadata("design:type", Array)
], ClientInquiryResponseDto.prototype, "response_data", void 0);

//# sourceMappingURL=client-inquiry-response.dto.js.map