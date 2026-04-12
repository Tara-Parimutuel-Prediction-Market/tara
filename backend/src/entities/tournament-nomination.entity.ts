import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { Tournament } from "./tournament.entity";
import { Market } from "./market.entity";
import { NominationVote } from "./nomination-vote.entity";

@Index(["tournamentId", "marketId"], { unique: true })
@Entity("tournament_nominations")
export class TournamentNomination {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  tournamentId: string;

  @ManyToOne(() => Tournament, (t) => t.nominations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tournamentId" })
  tournament: Tournament;

  @Column()
  marketId: string;

  @ManyToOne(() => Market, { onDelete: "CASCADE" })
  @JoinColumn({ name: "marketId" })
  market: Market;

  /** Which round this nomination is intended for (1=QF, 2=SF, 3=Final) */
  @Column({ default: 1 })
  targetRound: number;

  @Column({ default: 0 })
  voteCount: number;

  @OneToMany(() => NominationVote, (v) => v.nomination, { cascade: true })
  votes: NominationVote[];
}
