import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Removes balance columns from the users table and before/after snapshot
 * columns from the payments table.
 *
 * Existing user balances are migrated into the payments ledger as initial
 * DEPOSIT records so that the computed balance (SUM of payments) stays correct.
 */
export class RemoveUserBalanceColumns1711152000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Seed existing balances into the payments ledger (only if columns still exist) ──
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='creditsBalance') THEN
          INSERT INTO "payments" (
            "id", "type", "status", "method", "amount", "currency",
            "userId", "description", "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid(), 'deposit', 'success', 'credits',
            "creditsBalance", 'CREDITS', "id",
            'Initial credits balance (migrated)', NOW(), NOW()
          FROM "users" WHERE "creditsBalance" > 0;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='btnBalance') THEN
          INSERT INTO "payments" (
            "id", "type", "status", "method", "amount", "currency",
            "userId", "description", "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid(), 'deposit', 'success', 'dkbank',
            "btnBalance", 'BTN', "id",
            'Initial BTN balance (migrated)', NOW(), NOW()
          FROM "users" WHERE "btnBalance" > 0;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='usdtBalance') THEN
          INSERT INTO "payments" (
            "id", "type", "status", "method", "amount", "currency",
            "userId", "description", "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid(), 'deposit', 'success', 'ton',
            "usdtBalance", 'USDT', "id",
            'Initial USDT balance (migrated)', NOW(), NOW()
          FROM "users" WHERE "usdtBalance" > 0;
        END IF;
      END $$;
    `);

    // ── 2. Drop balance snapshot columns from payments ──────────────────────
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "creditsBalanceBefore"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "creditsBalanceAfter"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "btnBalanceBefore"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "btnBalanceAfter"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "usdtBalanceBefore"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "usdtBalanceAfter"`);

    // ── 3. Drop balance columns from users ──────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_creditsBalance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_btnBalance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_usdtBalance"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "creditsBalance"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "btnBalance"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "usdtBalance"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore columns with default values (data is not restored)
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "creditsBalance" decimal(18,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "btnBalance" decimal(18,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "usdtBalance" decimal(18,6) NOT NULL DEFAULT 0`);

    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "creditsBalanceBefore" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "creditsBalanceAfter" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "btnBalanceBefore" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "btnBalanceAfter" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "usdtBalanceBefore" decimal(18,6)`);
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "usdtBalanceAfter" decimal(18,6)`);
  }
}
