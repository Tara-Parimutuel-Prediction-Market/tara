import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Outcome } from "./outcome.entity";
import { Bet } from "./bet.entity";

export enum MarketStatus {
  UPCOMING = "upcoming",
  OPEN = "open",
  CLOSED = "closed",
  RESOLVING = "resolving",
  RESOLVED = "resolved",
  SETTLED = "settled",
  CANCELLED = "cancelled",
}

export enum MarketMechanism {
  PARIMUTUEL = "parimutuel",
}

export enum MarketCategory {
  SPORTS        = "sports",
  POLITICS      = "politics",
  WEATHER       = "weather",
  ENTERTAINMENT = "entertainment",
  ECONOMY       = "economy",
  OTHER         = "other",
}

@Entity("markets")
export class Market {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar", nullable: true })
  imageUrl: string;

  @Index()
  @Column({ type: "enum", enum: MarketStatus, default: MarketStatus.UPCOMING })
  status: MarketStatus;

  @Column({ type: "decimal", precision: 18, scale: 2, default: 0 })
  totalPool: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 5 })
  houseEdgePct: number; // e.g. 5 = 5%

  @Column({
    type: "enum",
    enum: MarketMechanism,
    default: MarketMechanism.PARIMUTUEL,
  })
  mechanism: MarketMechanism;

  @Column({ type: "decimal", precision: 18, scale: 2, default: 1000 })
  liquidityParam: number; // LMSR 'b' parameter

  @Column({
    type: "enum",
    enum: MarketCategory,
    default: MarketCategory.OTHER,
  })
  category: MarketCategory;

  @Column({ type: "uuid", nullable: true })
  resolvedOutcomeId: string;

  @Column({ type: "uuid", nullable: true })
  proposedOutcomeId: string;

  @Column({ type: "timestamptz", nullable: true })
  disputeDeadlineAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  opensAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  closesAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Outcome, (o) => o.market, { cascade: true, eager: true })
  outcomes: Outcome[];

  @OneToMany(() => Bet, (b) => b.market)
  bets: Bet[];
}
