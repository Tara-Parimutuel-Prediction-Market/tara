import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTournamentPrizePool1775980000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add prizePoolPct to tournaments
    await queryRunner.query(`
      ALTER TABLE "tournaments"
        ADD COLUMN IF NOT EXISTS "prizePoolPct" numeric(5,2) NOT NULL DEFAULT 50
    `);

    // Add tournament_prize to the transactions type enum
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."transactions_type_enum"
          ADD VALUE IF NOT EXISTS 'tournament_prize';
      EXCEPTION WHEN others THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "prizePoolPct"
    `);
    // Note: removing enum values in Postgres requires recreating the type —
    // left as a no-op for safety in down migration.
  }
}
