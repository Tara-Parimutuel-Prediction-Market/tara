import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReputationAndMarketCategory1711152000016
  implements MigrationInterface
{
  name = "AddReputationAndMarketCategory1711152000016";

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Market category enum + column ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."markets_category_enum"
      AS ENUM('sports','politics','weather','entertainment','economy','other')
    `);
    await queryRunner.query(`
      ALTER TABLE "markets"
      ADD COLUMN IF NOT EXISTS "category"
        "public"."markets_category_enum" NOT NULL DEFAULT 'other'
    `);

    // ── Reputation fields on users ───────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "reputationScore"
        DECIMAL(5,4) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "reputationTier"
        VARCHAR NOT NULL DEFAULT 'newcomer'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "totalPredictions"
        INTEGER NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "correctPredictions"
        INTEGER NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "categoryScores"
        JSONB NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "categoryScores"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "correctPredictions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totalPredictions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "reputationTier"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "reputationScore"`);
    await queryRunner.query(`ALTER TABLE "markets" DROP COLUMN IF EXISTS "category"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."markets_category_enum"`);
  }
}
