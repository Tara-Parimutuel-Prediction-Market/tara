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
import { IsEnum } from "class-validator";
import { StringField } from "../../../decorators/field.decorators.js";
export var IdType = /*#__PURE__*/ function(IdType) {
    IdType["CID"] = "CID";
    return IdType;
}({});
export class ClientInquiryDto {
}
_ts_decorate([
    ApiProperty({
        enum: IdType,
        description: "Type of ID",
        example: "CID"
    }),
    IsEnum(IdType),
    _ts_metadata("design:type", String)
], ClientInquiryDto.prototype, "id_type", void 0);
_ts_decorate([
    ApiProperty({
        description: "ID number (CID)",
        example: "10605001681",
        minLength: 11,
        maxLength: 11
    }),
    StringField({
        minLength: 11,
        maxLength: 11
    }),
    _ts_metadata("design:type", String)
], ClientInquiryDto.prototype, "id_number", void 0);

//# sourceMappingURL=client-inquiry.dto.js.map