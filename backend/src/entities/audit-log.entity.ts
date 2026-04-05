import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum AuditAction {
  // Market lifecycle
  MARKET_CREATE = "market.create",
  MARKET_UPDATE = "market.update",
  MARKET_DELETE = "market.delete",
  MARKET_TRANSITION = "market.transition",
  MARKET_PROPOSE = "market.propose",
  MARKET_RESOLVE = "market.resolve",
  MARKET_CANCEL = "market.cancel",

  // Balance / financial
  BALANCE_CREDIT = "balance.credit", // manual admin credit (future)
  PAYMENT_VIEW = "payment.view",

  // User management
  USER_ADMIN_TOGGLE = "user.admin_toggle",
  USER_VIEW = "user.view",
}

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** The admin user who performed the action */
  @Index()
  @Column()
  adminId: string;

  @Column({ type: "varchar", nullable: true })
  adminUsername: string;

  /** What action was performed */
  @Column({ type: "varchar" })
  action: AuditAction | string;

  /** The entity type affected (market, user, payment, etc.) */
  @Column({ type: "varchar", nullable: true })
  entityType: string;

  /** The UUID of the affected entity */
  @Column({ type: "varchar", nullable: true })
  entityId: string;

  /**
   * Full snapshot:
   *  - before: state before the change
   *  - after:  state after the change
   *  - meta:   any extra context (IP, request body, etc.)
   */
  @Column({ type: "jsonb", nullable: true })
  payload: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    meta?: Record<string, any>;
  };

  /** HTTP request IP address */
  @Column({ type: "varchar", nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
