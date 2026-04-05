function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
export class TransferToPublicAccountDto {
}
_ts_decorate([
    ApiProperty({
        description: "Source account number (obtained from verify-account endpoint)",
        example: "110162904970"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TransferToPublicAccountDto.prototype, "accountNumber", void 0);
_ts_decorate([
    ApiProperty({
        description: "Account holder name",
        example: "Jigme Namgyal"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TransferToPublicAccountDto.prototype, "accountName", void 0);
_ts_decorate([
    ApiProperty({
        description: "Amount to transfer in BTN",
        example: 150.0
    }),
    IsNumber(),
    Min(1),
    _ts_metadata("design:type", Number)
], TransferToPublicAccountDto.prototype, "amount", void 0);
_ts_decorate([
    ApiProperty({
        description: "Transfer description/narration",
        example: "Lottery entry payment",
        required: false
    }),
    IsString(),
    _ts_metadata("design:type", String)
], TransferToPublicAccountDto.prototype, "description", void 0);
_ts_decorate([
    ApiProperty({
        description: "CID number of the account holder",
        example: "10605001681"
    }),
    IsString(),
    IsNotEmpty(),
    _ts_metadata("design:type", String)
], TransferToPublicAccountDto.prototype, "cid", void 0);

//# sourceMappingURL=transfer-to-public-account.dto.js.map