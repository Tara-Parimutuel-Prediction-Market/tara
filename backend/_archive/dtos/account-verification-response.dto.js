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
import { StringField } from "../../../decorators/field.decorators.js";
import { StringFieldOptional } from "../../../decorators/field.decorators.js";
export class AccountVerificationResponseDto {
}
_ts_decorate([
    BooleanField(),
    _ts_metadata("design:type", Boolean)
], AccountVerificationResponseDto.prototype, "hasAccount", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], AccountVerificationResponseDto.prototype, "accountNumber", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], AccountVerificationResponseDto.prototype, "accountName", void 0);
_ts_decorate([
    StringFieldOptional(),
    _ts_metadata("design:type", String)
], AccountVerificationResponseDto.prototype, "balance", void 0);
_ts_decorate([
    StringField(),
    _ts_metadata("design:type", String)
], AccountVerificationResponseDto.prototype, "message", void 0);

//# sourceMappingURL=account-verification-response.dto.js.map