import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { AuthMethod } from "./auth-method.entity";
import { Bet } from "./bet.entity";
import { Payment } from "./payment.entity";
import { Transaction } from "./transaction.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  telegramId: string; // Telegram numeric user ID as string

  @Column({ nullable: true })
  telegramStreak: number; // Current winning streak in Telegram

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Index({ unique: true, sparse: true } as any)
  @Column({ nullable: true, unique: true })
  username: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ default: false })
  isAdmin: boolean;

  @Index({ unique: true, sparse: true } as any)
  @Column({ nullable: true, unique: true })
  dkCid: string; // DK Bank CID (11-digit national ID)

  @Index({ unique: true, sparse: true } as any)
  @Column({ nullable: true, unique: true })
  dkAccountNumber: string; // DK Bank account number resolved from CID

  @Column({ nullable: true })
  dkAccountName: string; // Full name from DK Bank account inquiry

  @Column({ nullable: true })
  phoneNumber: string; // Phone number from DK Bank account

  /** Telegram chat_id bound during phone-verification handshake. */
  @Index({ unique: true, sparse: true } as any)
  @Column({ nullable: true, unique: true })
  telegramChatId: string;

  /**
   * HMAC-SHA-256 hash of the Telegram-shared phone number.
   * Compared against dkPhoneHash on every payment to confirm identity.
   * NEVER stores the raw phone number.
   */
  @Column({ nullable: true })
  telegramPhoneHash: string;

  /**
   * HMAC-SHA-256 hash of the phone number returned by DK Bank for this CID.
   * Set at registration / DK-link time.
   */
  @Column({ nullable: true })
  dkPhoneHash: string;

  /** Timestamp when the Telegram account was successfully phone-verified. */
  @Column({ type: "timestamptz", nullable: true })
  telegramLinkedAt: Date | null;

  // Reputation 

  /** Overall accuracy score 0.0–1.0 (confidence-adjusted). Null until first market settles. */
  @Column({ type: "decimal", precision: 5, scale: 4, nullable: true })
  reputationScore: number | null;

  /** 'newcomer' | 'regular' | 'reliable' | 'expert' */
  @Column({ default: "newcomer" })
  reputationTier: string;

  /** Total resolved predictions (won + lost, excludes refunded). */
  @Column({ default: 0 })
  totalPredictions: number;

  /** Total correct predictions. */
  @Column({ default: 0 })
  correctPredictions: number;

  /**
   * Per-category accuracy scores stored as JSON.
   * Shape: { sports: { correct: 3, total: 5 }, politics: { correct: 1, total: 2 }, ... }
   */
  @Column({ type: "jsonb", nullable: true })
  categoryScores: Record<string, { correct: number; total: number }> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => AuthMethod, (am) => am.user)
  authMethods: AuthMethod[];

  @OneToMany(() => Bet, (b) => b.user)
  bets: Bet[];

  @OneToMany(() => Payment, (p) => p.user)
  payments: Payment[];

  @OneToMany(() => Transaction, (t) => t.user)
  transactions: Transaction[];
}
