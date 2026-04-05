import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../auth/guards";
import { Bet } from "../entities/bet.entity";

@ApiTags("bets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("bets")
export class BetsController {
  constructor(@InjectRepository(Bet) private betRepo: Repository<Bet>) {}

  @Get("my")
  @ApiOperation({ summary: "Get my betting history" })
  myBets(@Request() req: any) {
    return this.betRepo.find({
      where: { userId: req.user.userId },
      relations: ["market", "outcome"],
      order: { placedAt: "DESC" },
    });
  }
}
