import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Tournament } from "./tournament.entity";
import { Market } from "./market.entity";

export enum RoundStatus {
  PENDING = "pending",     // waiting for previous round to complete
  OPEN = "open",           // market is live — participants should place bets
  SCORING = "scoring",     // market settled, computing scores
  COMPLETED = "completed", // advancement determined
}

@Entity("tournament_rounds")
export class TournamentRound {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, (t) => t.rounds, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tournamentId" })
  tournament: Tournament;

  /** 1 = QF, 2 = SF, 3 = Final */
  @Column()
  roundNumber: number;

  @Column({ type: "varchar", length: 32 })
  roundLabel: string; // "Quarter Final", "Semi Final", "Final"

  @Column({ type: "uuid", nullable: true })
  marketId: string | null;

  @ManyToOne(() => Market, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "marketId" })
  market: Market | null;

  @Column({
    type: "enum",
    enum: RoundStatus,
    default: RoundStatus.PENDING,
  })
  status: RoundStatus;

  @Column({ type: "timestamptz", nullable: true })
  opensAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  closesAt: Date | null;
}
