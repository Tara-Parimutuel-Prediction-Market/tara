import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Payment } from "../entities/payment.entity";
import { UsersController } from "./users.controller";

@Module({
  imports: [TypeOrmModule.forFeature([User, Payment])],
  controllers: [UsersController],
})
export class UsersModule {}
