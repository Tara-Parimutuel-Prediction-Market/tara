import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReconciliationsTable1745240000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "marketId" uuid,
        "positionId" uuid,
        "settlementId" uuid,
        "type" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "expectedAmount" numeric(20,9) NOT NULL,
        "actualAmount" numeric(20,9) NOT NULL,
        "difference" numeric(20,9) NOT NULL,
        "balanceBeforeExpected" numeric(20,9),
        "balanceAfterExpected" numeric(20,9),
        "balanceBeforeActual" numeric(20,9),
        "balanceAfterActual" numeric(20,9),
        "dkTransferId" varchar,
        "dkStatus" varchar,
        "dkTransferAmount" numeric(20,9),
        "details" jsonb,
        "notes" text,
        "resolutionAction" text,
        "correctionTransactionId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "resolvedAt" TIMESTAMP,
        CONSTRAINT "PK_reconciliations" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_userId" ON "reconciliations" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_marketId" ON "reconciliations" ("marketId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_positionId" ON "reconciliations" ("positionId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_settlementId" ON "reconciliations" ("settlementId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_status" ON "reconciliations" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_type" ON "reconciliations" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliations_createdAt" ON "reconciliations" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliations"`);
  }
}
