import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Tournament, TournamentStatus } from "../entities/tournament.entity";
import {
  TournamentRound,
  RoundStatus,
} from "../entities/tournament-round.entity";
import {
  TournamentParticipant,
  ParticipantStatus,
} from "../entities/tournament-participant.entity";
import { TournamentNomination } from "../entities/tournament-nomination.entity";
import { NominationVote } from "../entities/nomination-vote.entity";
import { Position, PositionStatus } from "../entities/position.entity";
import { Settlement } from "../entities/settlement.entity";
import { Transaction, TransactionType } from "../entities/transaction.entity";

const ROUND_LABELS: Record<number, string> = {
  1: "Quarter Final",
  2: "Semi Final",
  3: "Final",
};

@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentRepo: Repository<Tournament>,
    @InjectRepository(TournamentRound)
    private roundRepo: Repository<TournamentRound>,
    @InjectRepository(TournamentParticipant)
    private participantRepo: Repository<TournamentParticipant>,
    @InjectRepository(TournamentNomination)
    private nominationRepo: Repository<TournamentNomination>,
    @InjectRepository(NominationVote)
    private voteRepo: Repository<NominationVote>,
    @InjectRepository(Position)
    private positionRepo: Repository<Position>,
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    private dataSource: DataSource,
  ) {}

  // ── Admin: create tournament ───────────────────────────────────────────────

  async createTournament(dto: {
    name: string;
    description?: string;
    maxParticipants?: number;
    nominationDeadline: string;
    registrationDeadline: string;
    prizePoolPct?: number;
  }): Promise<Tournament> {
    const totalRounds = 3; // QF → SF → Final
    const rounds = Array.from({ length: totalRounds }, (_, i) =>
      this.roundRepo.create({
        roundNumber: i + 1,
        roundLabel: ROUND_LABELS[i + 1],
        status: RoundStatus.PENDING,
        marketId: null,
        opensAt: null,
        closesAt: null,
      }),
    );

    const tournament = this.tournamentRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      maxParticipants: dto.maxParticipants ?? 16,
      nominationDeadline: new Date(dto.nominationDeadline),
      registrationDeadline: new Date(dto.registrationDeadline),
      prizePoolPct: dto.prizePoolPct ?? 50,
      status: TournamentStatus.NOMINATIONS,
      rounds,
    });
    return this.tournamentRepo.save(tournament);
  }

  // ── Admin: add a market nomination for a round ────────────────────────────

  async addNomination(
    tournamentId: string,
    marketId: string,
    targetRound: number,
  ): Promise<TournamentNomination> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException("Tournament not found");
    if (tournament.status !== TournamentStatus.NOMINATIONS) {
      throw new BadRequestException("Nominations are closed");
    }
    const existing = await this.nominationRepo.findOne({
      where: { tournamentId, marketId },
    });
    if (existing) throw new BadRequestException("Market already nominated");

    const nomination = this.nominationRepo.create({
      tournamentId,
      marketId,
      targetRound,
      voteCount: 0,
    });
    return this.nominationRepo.save(nomination);
  }

  async removeNomination(
    tournamentId: string,
    nominationId: string,
  ): Promise<void> {
    const nomination = await this.nominationRepo.findOne({
      where: { id: nominationId, tournamentId },
    });
    if (!nomination) throw new NotFoundException("Nomination not found");
    await this.nominationRepo.remove(nomination);
  }

  /** Move tournament from REGISTRATION → ACTIVE and open Round 1. */
  async startTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
      relations: ["rounds"],
    });
    if (!tournament) throw new NotFoundException("Tournament not found");
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException(
        "Tournament must be in REGISTRATION phase to start",
      );
    }

    // Open the first round
    const round1 = tournament.rounds.find((r) => r.roundNumber === 1);
    if (round1) {
      round1.status = RoundStatus.OPEN;
      await this.roundRepo.save(round1);
    }

    tournament.status = TournamentStatus.ACTIVE;
    return this.tournamentRepo.save(tournament);
  }

  // ── User: vote for a nomination (max 3 votes per user per tournament) ─────

  async vote(
    tournamentId: string,
    nominationId: string,
    userId: string,
  ): Promise<void> {
    const nomination = await this.nominationRepo.findOne({
      where: { id: nominationId, tournamentId },
    });
    if (!nomination) throw new NotFoundException("Nomination not found");

    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
    });
    if (!tournament || tournament.status !== TournamentStatus.NOMINATIONS) {
      throw new BadRequestException("Voting is not open");
    }
    if (new Date() > tournament.nominationDeadline) {
      throw new BadRequestException("Voting has closed");
    }

    const existing = await this.voteRepo.findOne({
      where: { nominationId, userId },
    });
    if (existing)
      throw new BadRequestException("Already voted for this market");

    // Max 3 votes per user per tournament
    const userVoteCount = await this.voteRepo
      .createQueryBuilder("v")
      .innerJoin("v.nomination", "n")
      .where("n.tournamentId = :tournamentId", { tournamentId })
      .andWhere("v.userId = :userId", { userId })
      .getCount();
    if (userVoteCount >= 3) {
      throw new BadRequestException(
        "You can only vote for 3 markets per tournament",
      );
    }

    await this.dataSource.transaction(async (em) => {
      await em.save(
        NominationVote,
        em.create(NominationVote, { nominationId, userId }),
      );
      await em
        .createQueryBuilder()
        .update(TournamentNomination)
        .set({ voteCount: () => "vote_count + 1" })
        .where("id = :id", { id: nominationId })
        .execute();
    });
  }

  // ── User: register for a tournament ──────────────────────────────────────

  async register(
    tournamentId: string,
    userId: string,
  ): Promise<TournamentParticipant> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException("Tournament not found");
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException("Registration is not open");
    }
    if (new Date() > tournament.registrationDeadline) {
      throw new BadRequestException("Registration has closed");
    }

    const count = await this.participantRepo.count({
      where: { tournamentId },
    });
    if (count >= tournament.maxParticipants) {
      throw new BadRequestException("Tournament is full");
    }

    const existing = await this.participantRepo.findOne({
      where: { tournamentId, userId },
    });
    if (existing) throw new BadRequestException("Already registered");

    const participant = this.participantRepo.create({
      tournamentId,
      userId,
      status: ParticipantStatus.ACTIVE,
      currentRound: 1,
      totalConfidenceScore: 0,
      correctPredictions: 0,
    });
    return this.participantRepo.save(participant);
  }

  // ── Admin: close nominations and assign top-voted markets to rounds ────────

  async closeNominations(tournamentId: string): Promise<Tournament> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
      relations: ["rounds", "nominations"],
    });
    if (!tournament) throw new NotFoundException("Tournament not found");
    if (tournament.status !== TournamentStatus.NOMINATIONS) {
      throw new BadRequestException("Already past nominations phase");
    }

    // For each round, pick the top-voted nomination with that targetRound
    for (const round of tournament.rounds) {
      const topNomination = await this.nominationRepo.findOne({
        where: { tournamentId, targetRound: round.roundNumber },
        order: { voteCount: "DESC" },
      });
      if (topNomination) {
        round.marketId = topNomination.marketId;
        await this.roundRepo.save(round);
      }
    }

    tournament.status = TournamentStatus.REGISTRATION;
    return this.tournamentRepo.save(tournament);
  }

  // ── Score a round after its market settles ────────────────────────────────

  /**
   * Called by the market settlement hook. Finds any OPEN tournament round
   * linked to the settled market, scores all active participants, and advances
   * those who predicted correctly.
   *
   * Scoring: correct prediction → confidenceScore = 1 - |poolPctAtBet - 0.5| * 2
   *          wrong prediction → eliminated
   *
   * In the Final: highest confidenceScore wins; runner-up is eliminated.
   */
  async scoreRound(marketId: string, winningOutcomeId: string): Promise<void> {
    const rounds = await this.roundRepo.find({
      where: { marketId, status: RoundStatus.OPEN },
    });
    if (rounds.length === 0) return;

    for (const round of rounds) {
      round.status = RoundStatus.SCORING;
      await this.roundRepo.save(round);

      const participants = await this.participantRepo.find({
        where: {
          tournamentId: round.tournamentId,
          status: ParticipantStatus.ACTIVE,
          currentRound: round.roundNumber,
        },
      });

      for (const participant of participants) {
        const position = await this.positionRepo.findOne({
          where: {
            userId: participant.userId,
            marketId: round.marketId!,
          },
        });

        const isCorrect =
          position?.status === PositionStatus.WON ||
          position?.outcomeId === winningOutcomeId;

        if (isCorrect && position) {
          const poolPct = Number(position.poolPctAtBet ?? 0.5);
          const confidenceScore = 1 - Math.abs(poolPct - 0.5) * 2;
          participant.totalConfidenceScore =
            Number(participant.totalConfidenceScore) + confidenceScore;
          participant.correctPredictions += 1;

          if (round.roundNumber < 3) {
            // Not the final — advance to next round
            participant.currentRound = round.roundNumber + 1;
          }
        } else {
          // Wrong or no bet — eliminated (unless it's the final, handled below)
          if (round.roundNumber < 3) {
            participant.status = ParticipantStatus.ELIMINATED;
          }
        }
        await this.participantRepo.save(participant);
      }

      // Final: pick winner by confidence score among correct predictors
      if (round.roundNumber === 3) {
        await this.resolveFinal(round.tournamentId);
      }

      round.status = RoundStatus.COMPLETED;
      await this.roundRepo.save(round);

      // If all rounds completed, mark tournament done
      await this.maybeCompleteTournament(round.tournamentId);
    }
  }

  private async resolveFinal(tournamentId: string): Promise<void> {
    const finalists = await this.participantRepo.find({
      where: {
        tournamentId,
        status: ParticipantStatus.ACTIVE,
        currentRound: 3,
      },
      order: { totalConfidenceScore: "DESC", correctPredictions: "DESC" },
    });

    if (finalists.length === 0) return;

    finalists[0].status = ParticipantStatus.WINNER;
    await this.participantRepo.save(finalists[0]);

    for (const f of finalists.slice(1)) {
      f.status = ParticipantStatus.ELIMINATED;
      await this.participantRepo.save(f);
    }

    await this.tournamentRepo.update(
      { id: tournamentId },
      { winnerId: finalists[0].userId, status: TournamentStatus.COMPLETED },
    );

    // ── Prize payout from platform fees ────────────────────────────────────
    // Sum houseAmount from all 3 round markets' settlement records.
    // Then redistribute prizePoolPct% of that:
    //   🥇 Winner      → 60%
    //   🥈 Runner-up   → 25%
    //   🏠 House keeps → 15% (plus the remaining (100 - prizePoolPct)%)
    await this.distributeTournamentPrizes(tournamentId, finalists);
  }

  private async distributeTournamentPrizes(
    tournamentId: string,
    finalists: TournamentParticipant[],
  ): Promise<void> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
      relations: ["rounds"],
    });
    if (!tournament) return;

    // Collect house fees from all round markets
    const marketIds = tournament.rounds
      .filter((r) => r.marketId)
      .map((r) => r.marketId!);

    if (marketIds.length === 0) return;

    const settlements = await this.dataSource
      .getRepository(Settlement)
      .createQueryBuilder("s")
      .where("s.marketId IN (:...marketIds)", { marketIds })
      .getMany();

    const totalHouseFees = settlements.reduce(
      (sum, s) => sum + Number(s.houseAmount),
      0,
    );
    if (totalHouseFees <= 0) return;

    const prizePool = totalHouseFees * (Number(tournament.prizePoolPct) / 100);

    // Prize splits
    const WINNER_SHARE = 0.6;
    const RUNNER_UP_SHARE = 0.25;

    const winner = finalists[0];
    const runnerUp = finalists[1] ?? null;

    await this.dataSource.transaction(async (em) => {
      // Helper: credit a user
      const creditUser = async (
        userId: string,
        amount: number,
        label: string,
      ) => {
        if (amount <= 0) return;
        const balanceResult = await em
          .getRepository(Transaction)
          .createQueryBuilder("t")
          .select("COALESCE(SUM(t.amount), 0)", "balance")
          .where("t.userId = :userId", { userId })
          .getRawOne();
        const balanceBefore = Number(balanceResult?.balance ?? 0);
        await em.save(
          Transaction,
          em.create(Transaction, {
            type: TransactionType.TOURNAMENT_PRIZE,
            amount: parseFloat(amount.toFixed(2)),
            balanceBefore,
            balanceAfter: balanceBefore + parseFloat(amount.toFixed(2)),
            userId,
            note: `Tournament prize — ${label} (${tournament.name})`,
          }),
        );
      };

      await creditUser(winner.userId, prizePool * WINNER_SHARE, "🥇 Champion");

      if (runnerUp) {
        await creditUser(
          runnerUp.userId,
          prizePool * RUNNER_UP_SHARE,
          "🥈 Runner-up",
        );
      }
    });
  }

  private async maybeCompleteTournament(tournamentId: string): Promise<void> {
    const rounds = await this.roundRepo.find({ where: { tournamentId } });
    const allDone = rounds.every((r) => r.status === RoundStatus.COMPLETED);
    if (allDone) {
      await this.tournamentRepo.update(
        { id: tournamentId, status: TournamentStatus.ACTIVE },
        { status: TournamentStatus.COMPLETED },
      );
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findAll(): Promise<Tournament[]> {
    return this.tournamentRepo.find({
      order: { createdAt: "DESC" },
      relations: ["rounds", "rounds.market"],
    });
  }

  async findOne(id: string): Promise<Tournament> {
    const t = await this.tournamentRepo.findOne({
      where: { id },
      relations: [
        "rounds",
        "rounds.market",
        "nominations",
        "nominations.market",
      ],
    });
    if (!t) throw new NotFoundException("Tournament not found");
    return t;
  }

  async getLeaderboard(tournamentId: string) {
    return this.participantRepo.find({
      where: { tournamentId },
      relations: ["user"],
      order: {
        correctPredictions: "DESC",
        totalConfidenceScore: "DESC",
      },
    });
  }

  async getMyParticipation(tournamentId: string, userId: string) {
    return this.participantRepo.findOne({
      where: { tournamentId, userId },
    });
  }

  async getNominations(tournamentId: string) {
    return this.nominationRepo.find({
      where: { tournamentId },
      relations: ["market"],
      order: { voteCount: "DESC" },
    });
  }
}
