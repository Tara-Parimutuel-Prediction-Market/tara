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

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  BET_PLACED = "bet_placed",
  BET_PAYOUT = "bet_payout",
  REFUND = "refund",
}

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: TransactionType })
  type: TransactionType;

  @Column({ type: "decimal", precision: 20, scale: 9 })
  amount: number;

  @Column({ type: "decimal", precision: 20, scale: 9 })
  balanceBefore: number;

  @Column({ type: "decimal", precision: 20, scale: 9 })
  balanceAfter: number;

  @Index()
  @Column({ nullable: true })
  paymentId: string;

  @Index()
  @Column({ nullable: true })
  betId: string;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (u) => u.transactions, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;
}
