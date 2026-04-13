import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReferralPrizeClaimed1775990000001 implements MigrationInterface {
  name = "AddReferralPrizeClaimed1775990000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add referralPrizeClaimed flag to users
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "referralPrizeClaimed" boolean NOT NULL DEFAULT false
    `);

    // Add referral_prize to the transactions type enum (idempotent)
    await queryRunner.query(`
      ALTER TYPE "public"."transactions_type_enum"
        ADD VALUE IF NOT EXISTS 'referral_prize'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "referralPrizeClaimed"
    `);
    // Note: PostgreSQL does not support removing enum values — leave referral_prize in place
  }
}
