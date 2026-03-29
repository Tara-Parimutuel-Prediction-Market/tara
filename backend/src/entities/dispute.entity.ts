import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Market } from "./market.entity";

@Entity("disputes")
export class Dispute {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "decimal", precision: 18, scale: 2 })
  bondAmount: number;

  @Column({ type: "text", nullable: true })
  reason: string;

  @Column({ default: false })
  bondRefunded: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Market, { onDelete: "CASCADE" })
  @JoinColumn()
  market: Market;

  @Column()
  marketId: string;
}
