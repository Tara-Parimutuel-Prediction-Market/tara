import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tournament } from "../entities/tournament.entity";
import { TournamentRound } from "../entities/tournament-round.entity";
import { TournamentParticipant } from "../entities/tournament-participant.entity";
import { TournamentNomination } from "../entities/tournament-nomination.entity";
import { NominationVote } from "../entities/nomination-vote.entity";
import { Position } from "../entities/position.entity";
import { Settlement } from "../entities/settlement.entity";
import { Transaction } from "../entities/transaction.entity";
import { TournamentsService } from "./tournaments.service";
import { TournamentsController } from "./tournaments.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tournament,
      TournamentRound,
      TournamentParticipant,
      TournamentNomination,
      NominationVote,
      Position,
      Settlement,
      Transaction,
    ]),
  ],
  providers: [TournamentsService],
  controllers: [TournamentsController],
  exports: [TournamentsService],
})
export class TournamentsModule {}
