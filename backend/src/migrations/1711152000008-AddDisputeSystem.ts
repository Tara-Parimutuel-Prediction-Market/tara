import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisputeSystem1711152000008 implements MigrationInterface {
  name = "AddDisputeSystem1711152000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add 'resolving' to the markets status enum
    await queryRunner.query(`
      ALTER TYPE "markets_status_enum" ADD VALUE IF NOT EXISTS 'resolving'
    `);

    // 2. Add proposedOutcomeId column to markets
    await queryRunner.query(`
      ALTER TABLE "markets"
      ADD COLUMN IF NOT EXISTS "proposedOutcomeId" character varying
    `);

    // 3. Add disputeDeadlineAt column to markets
    await queryRunner.query(`
      ALTER TABLE "markets"
      ADD COLUMN IF NOT EXISTS "disputeDeadlineAt" TIMESTAMP WITH TIME ZONE
    `);

    // 4. Create disputes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disputes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bondAmount" numeric(18,2) NOT NULL,
        "reason" text,
        "bondRefunded" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "marketId" uuid NOT NULL,
        CONSTRAINT "PK_disputes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_disputes_userId" FOREIGN KEY ("userId")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_disputes_marketId" FOREIGN KEY ("marketId")
          REFERENCES "markets" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_marketId" ON "disputes" ("marketId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_userId" ON "disputes" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_marketId"`);

    // Drop disputes table
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes"`);

    // Remove columns from markets
    await queryRunner.query(`ALTER TABLE "markets" DROP COLUMN IF EXISTS "disputeDeadlineAt"`);
    await queryRunner.query(`ALTER TABLE "markets" DROP COLUMN IF EXISTS "proposedOutcomeId"`);

    // Note: PostgreSQL does not support removing enum values directly.
    // The 'resolving' value remains in the enum type on rollback.
  }
}
