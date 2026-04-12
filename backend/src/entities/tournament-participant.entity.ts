import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Tournament } from "./tournament.entity";
import { User } from "./user.entity";

export enum ParticipantStatus {
  ACTIVE = "active",
  ELIMINATED = "eliminated",
  WINNER = "winner",
}

@Index(["tournamentId", "userId"], { unique: true })
@Entity("tournament_participants")
export class TournamentParticipant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, (t) => t.participants, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tournamentId" })
  tournament: Tournament;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({
    type: "enum",
    enum: ParticipantStatus,
    default: ParticipantStatus.ACTIVE,
  })
  status: ParticipantStatus;

  /** Round the participant reached before elimination (or current round if active) */
  @Column({ default: 1 })
  currentRound: number;

  /**
   * Sum of confidence scores across all correct predictions in this tournament.
   * confidenceScore per round = 1 - |poolPctAtBet - 0.5| * 2  (range 0–1)
   * Used as primary ranking metric and tiebreaker.
   */
  @Column({ type: "decimal", precision: 10, scale: 6, default: 0 })
  totalConfidenceScore: number;

  /** Number of rounds predicted correctly */
  @Column({ default: 0 })
  correctPredictions: number;

  @CreateDateColumn()
  registeredAt: Date;
}
