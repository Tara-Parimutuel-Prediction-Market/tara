import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { TournamentRound } from "./tournament-round.entity";
import { TournamentParticipant } from "./tournament-participant.entity";
import { TournamentNomination } from "./tournament-nomination.entity";

export enum TournamentStatus {
  NOMINATIONS = "nominations", // users vote on markets
  REGISTRATION = "registration", // bracket drawn, users sign up
  ACTIVE = "active", // rounds are running
  COMPLETED = "completed", // winner determined
  CANCELLED = "cancelled",
}

@Entity("tournaments")
export class Tournament {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({
    type: "enum",
    enum: TournamentStatus,
    default: TournamentStatus.NOMINATIONS,
  })
  status: TournamentStatus;

  /** How many players can enter (must be a power of 2: 8, 16, 32) */
  @Column({ default: 16 })
  maxParticipants: number;

  /** Voting closes at this time — keeper transitions to REGISTRATION */
  @Column({ type: "timestamptz" })
  nominationDeadline: Date;

  /** Registration closes; bracket is locked */
  @Column({ type: "timestamptz" })
  registrationDeadline: Date;

  /**
   * % of total house fees collected across all 3 round markets that is
   * redistributed as tournament prizes.
   * e.g. 50 → 50% of house fees → winner gets 60% of that, runner-up 25%, house keeps 15%.
   * Defaults to 50.
   */
  @Column({ type: "decimal", precision: 5, scale: 2, default: 50 })
  prizePoolPct: number;

  @Column({ type: "uuid", nullable: true })
  winnerId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TournamentRound, (r) => r.tournament, { cascade: true })
  rounds: TournamentRound[];

  @OneToMany(() => TournamentParticipant, (p) => p.tournament, {
    cascade: true,
  })
  participants: TournamentParticipant[];

  @OneToMany(() => TournamentNomination, (n) => n.tournament, {
    cascade: true,
  })
  nominations: TournamentNomination[];
}
