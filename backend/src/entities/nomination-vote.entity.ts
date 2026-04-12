import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { TournamentNomination } from "./tournament-nomination.entity";
import { User } from "./user.entity";

@Index(["nominationId", "userId"], { unique: true })
@Entity("nomination_votes")
export class NominationVote {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nominationId: string;

  @ManyToOne(() => TournamentNomination, (n) => n.votes, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "nominationId" })
  nomination: TournamentNomination;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
