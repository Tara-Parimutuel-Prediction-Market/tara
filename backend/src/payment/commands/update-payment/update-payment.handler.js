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
import { PaymentEntity } from "../../payment.entity.js";
import { PaymentNotFoundException } from "../../exceptions/payment-not-found.exception.js";
import { UpdatePaymentCommand } from "./update-payment.command.js";
export class UpdatePaymentHandler {
    constructor(paymentRepository){
        this.paymentRepository = paymentRepository;
    }
    async execute(command) {
        const { paymentId, updatePaymentDto } = command;
        const payment = await this.paymentRepository.findOne({
            where: {
                id: paymentId
            }
        });
        if (!payment) {
            throw new PaymentNotFoundException(paymentId);
        }
        Object.assign(payment, updatePaymentDto);
        return this.paymentRepository.save(payment);
    }
}
_ts_decorate([
    Transactional(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof UpdatePaymentCommand === "undefined" ? Object : UpdatePaymentCommand
    ]),
    _ts_metadata("design:returntype", Promise)
], UpdatePaymentHandler.prototype, "execute", null);
UpdatePaymentHandler = _ts_decorate([
    CommandHandler(UpdatePaymentCommand),
    _ts_param(0, InjectRepository(PaymentEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof Repository === "undefined" ? Object : Repository
    ])
], UpdatePaymentHandler);

//# sourceMappingURL=update-payment.handler.js.map