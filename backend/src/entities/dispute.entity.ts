import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { User } from "./user.entity";
import { Market } from "./market.entity";

@Entity("disputes")
export class Dispute {
  @ApiProperty({ example: "uuid" })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ example: 10, description: "Bond amount in credits" })
  @Column({ type: "decimal", precision: 18, scale: 2 })
  bondAmount: number;

  @ApiPropertyOptional({ example: "The match result was different", description: "Reason for disputing" })
  @Column({ type: "text", nullable: true })
  reason: string;

  @ApiPropertyOptional({ description: "DK Bank payment ID used as bond (null if paid from credits)" })
  @Column({ type: "uuid", nullable: true })
  bondPaymentId: string | null;

  @ApiProperty({ example: false, description: "Whether the bond has been refunded" })
  @Column({ default: false })
  bondRefunded: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn()
  user: User;

  @ApiProperty()
  @Column()
  userId: string;

  @ManyToOne(() => Market, { onDelete: "CASCADE" })
  @JoinColumn()
  market: Market;

  @ApiProperty()
  @Column()
  marketId: string;
}
