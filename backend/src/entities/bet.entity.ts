import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Market } from "./market.entity";
import { Outcome } from "./outcome.entity";

export enum BetStatus {
  PENDING = "pending",
  WON = "won",
  LOST = "lost",
  REFUNDED = "refunded",
}

@Index(["userId", "marketId"])
@Entity("bets")
export class Bet {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "decimal", precision: 18, scale: 2 })
  amount: number;

  @Column({ type: "enum", enum: BetStatus, default: BetStatus.PENDING })
  status: BetStatus;

  @Column({ type: "decimal", precision: 10, scale: 4, nullable: true })
  oddsAtPlacement: number;

  @Column({ type: "decimal", precision: 18, scale: 4, nullable: true })
  shares: number; // Number of shares filled (SCPM)

  @Column({ type: "decimal", precision: 10, scale: 6, nullable: true })
  limitPrice: number; // Target price/probability (SCPM)

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  payout: number;

  @CreateDateColumn()
  placedAt: Date;

  @ManyToOne(() => User, (u) => u.bets, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Market, (m) => m.bets)
  @JoinColumn()
  market: Market;

  @Column()
  marketId: string;

  @ManyToOne(() => Outcome, (o) => o.bets)
  @JoinColumn()
  outcome: Outcome;

  @Column()
  outcomeId: string;
}
