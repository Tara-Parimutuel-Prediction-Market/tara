import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentOtpTable1711152000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payment_otps_status_enum" AS ENUM (
        'pending',
        'verified',
        'expired',
        'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_otps" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "status"          "payment_otps_status_enum" NOT NULL DEFAULT 'pending',

        -- Timing
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expiresAt"       TIMESTAMPTZ NOT NULL,
        "lastRequestedAt" TIMESTAMPTZ,
        "verifiedAt"      TIMESTAMPTZ,
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),

        -- Attempt tracking
        "requestCount"    INTEGER NOT NULL DEFAULT 1,
        "failedAttempts"  INTEGER NOT NULL DEFAULT 0,

        -- DK Bank reference
        "bfsTxnId"        VARCHAR,

        -- Foreign keys (stored as plain columns)
        "paymentId"       UUID,
        "userId"          UUID NOT NULL,
        "marketId"        UUID,
        "disputeId"       UUID,

        CONSTRAINT "PK_payment_otps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_otps_payment"
          FOREIGN KEY ("paymentId")  REFERENCES "payments"("id")  ON DELETE SET NULL,
        CONSTRAINT "FK_payment_otps_user"
          FOREIGN KEY ("userId")     REFERENCES "users"("id")     ON DELETE CASCADE,
        CONSTRAINT "FK_payment_otps_market"
          FOREIGN KEY ("marketId")   REFERENCES "markets"("id")   ON DELETE SET NULL,
        CONSTRAINT "FK_payment_otps_dispute"
          FOREIGN KEY ("disputeId")  REFERENCES "disputes"("id")  ON DELETE SET NULL
      )
    `);

    // Indexes for common lookup patterns
    await queryRunner.query(`CREATE INDEX "IDX_payment_otps_paymentId"  ON "payment_otps" ("paymentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_otps_userId"     ON "payment_otps" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_otps_marketId"   ON "payment_otps" ("marketId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_otps_disputeId"  ON "payment_otps" ("disputeId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_otps"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_otps_status_enum"`);
  }
}
