import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum PaymentType {
  DEPOSIT = "deposit",
  WITHDRAWAL = "withdrawal",
  BET_PLACED = "bet_placed",
  BET_PAYOUT = "bet_payout",
  REFUND = "refund",
}

export enum PaymentStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  DK_BANK = "dkbank",
  TON = "ton",
  CREDITS = "credits",
}

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: PaymentType })
  type: PaymentType;

  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: "enum", enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: "decimal", precision: 18, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 10, default: "BTN" })
  currency: string;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  balanceBefore: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  balanceAfter: number;

  @Column({ nullable: true })
  externalPaymentId: string; // DK Bank transaction ID, TON transaction hash, etc.

  @Column({ nullable: true })
  referenceId: string; // betId, marketId, or other reference

  @Column({ nullable: true })
  customerPhone: string; // For DK Bank payments

  @Column({ nullable: true })
  description: string;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>; // Additional payment gateway data

  @Column({ nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.payments, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @Column()
  userId: string;
}
