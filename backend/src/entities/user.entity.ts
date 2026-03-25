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

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ nullable: true })
  telegramId: string; // Telegram numeric user ID as string

  @Column({ nullable: true })
  telegramChatId: number; // Telegram chat ID for notifications

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

  @Column({ type: "decimal", precision: 18, scale: 2, default: 1000 })
  balance: number; // New users start with 1000 credits

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
}
