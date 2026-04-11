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
  POSITION_OPENED = "bet_placed",
  POSITION_PAYOUT = "bet_payout",
  REFUND = "refund",
  DISPUTE_BOND = "dispute_bond",
  DISPUTE_REFUND = "dispute_refund",
  REFERRAL_BONUS = "referral_bonus",
}

// Back-compat aliases
export const BET_PLACED = TransactionType.POSITION_OPENED;
export const BET_PAYOUT = TransactionType.POSITION_PAYOUT;

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
  @Column({ type: "uuid", nullable: true })
  paymentId: string;

  @Index()
  @Column({ type: "uuid", nullable: true })
  positionId: string;

  @Column({ type: "varchar", nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (u) => u.transactions, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;
}
