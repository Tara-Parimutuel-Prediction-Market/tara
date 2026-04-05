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
export class TransferToPublicAccountResponseDto {
}
_ts_decorate([
    ApiProperty({
        description: "Transaction ID for tracking",
        example: "uuid-here"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "transactionId", void 0);
_ts_decorate([
    ApiProperty({
        description: "Current transaction status",
        example: "PROCESSING"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "status", void 0);
_ts_decorate([
    ApiProperty({
        description: "Transferred amount",
        example: 150.0
    }),
    _ts_metadata("design:type", Number)
], TransferToPublicAccountResponseDto.prototype, "amount", void 0);
_ts_decorate([
    ApiProperty({
        description: "Currency",
        example: "BTN"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "currency", void 0);
_ts_decorate([
    ApiProperty({
        description: "Source account number",
        example: "110162904970"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "sourceAccountNumber", void 0);
_ts_decorate([
    ApiProperty({
        description: "Source account holder name",
        example: "Jigme Namgyal"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "sourceAccountName", void 0);
_ts_decorate([
    ApiProperty({
        description: "Public account number (destination)",
        example: "110162904970"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "publicAccountNumber", void 0);
_ts_decorate([
    ApiProperty({
        description: "DK Gateway inquiry ID",
        example: "IN5D28B9114B1D4DC5BCBFDE04CD6973A2"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "inquiryId", void 0);
_ts_decorate([
    ApiProperty({
        description: "DK Gateway transaction status ID",
        example: "6f67d4ca-c8f9-49a5-8c2d-96c8b07c74e5"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "txnStatusId", void 0);
_ts_decorate([
    ApiProperty({
        description: "Response message",
        example: "Transfer to public account initiated successfully"
    }),
    _ts_metadata("design:type", String)
], TransferToPublicAccountResponseDto.prototype, "message", void 0);

//# sourceMappingURL=transfer-to-public-account-response.dto.js.map