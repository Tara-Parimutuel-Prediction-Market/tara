import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTournamentTables1775990000000 implements MigrationInterface {
  name = "DropTournamentTables1775990000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in dependency order (children first)
    await queryRunner.query(`DROP TABLE IF EXISTS "nomination_votes" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tournament_nominations" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "tournament_participants" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tournament_rounds" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournaments" CASCADE`);

    // Drop the tournament status enum if it exists
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."tournaments_status_enum" CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."tournament_rounds_status_enum" CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."tournament_participants_status_enum" CASCADE`,
    );

    // Add referral_prize to the transactions type enum (replaces tournament_prize usage)
    await queryRunner.query(`
      ALTER TYPE "public"."transactions_type_enum"
        ADD VALUE IF NOT EXISTS 'referral_prize';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally left empty — we do not want to re-create tournament tables
  }
}
