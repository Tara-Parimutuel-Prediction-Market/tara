function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
import { CommandHandler } from "@nestjs/cqrs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Transactional } from "typeorm-transactional";
import { PaymentStatus } from "../../../../constants/payment-status.js";
import { PaymentEntity } from "../../payment.entity.js";
import { CreatePaymentCommand } from "./create-payment.command.js";
export class CreatePaymentHandler {
    constructor(paymentRepository){
        this.paymentRepository = paymentRepository;
    }
    async execute(command) {
        const { userId, createPaymentDto } = command;
        const payment = this.paymentRepository.create({
            ...createPaymentDto,
            userId,
            status: PaymentStatus.PENDING,
            currency: createPaymentDto.currency || "BTN"
        });
        return this.paymentRepository.save(payment);
    }
}
_ts_decorate([
    Transactional(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof CreatePaymentCommand === "undefined" ? Object : CreatePaymentCommand
    ]),
    _ts_metadata("design:returntype", Promise)
], CreatePaymentHandler.prototype, "execute", null);
CreatePaymentHandler = _ts_decorate([
    CommandHandler(CreatePaymentCommand),
    _ts_param(0, InjectRepository(PaymentEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof Repository === "undefined" ? Object : Repository
    ])
], CreatePaymentHandler);

//# sourceMappingURL=create-payment.handler.js.map