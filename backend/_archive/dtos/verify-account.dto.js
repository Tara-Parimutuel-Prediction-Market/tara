function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
import { StringField } from "../../../decorators/field.decorators.js";
export class VerifyAccountDto {
}
_ts_decorate([
    StringField({
        minLength: 11,
        maxLength: 11
    }),
    _ts_metadata("design:type", String)
], VerifyAccountDto.prototype, "cid", void 0);

//# sourceMappingURL=verify-account.dto.js.map