import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateStarterCreditsToTransactions1711152000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transaction rows for starter credit payments that have no corresponding transaction
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "type", "amount", "balanceBefore", "balanceAfter", "paymentId", "userId", "note", "createdAt")
      SELECT
        gen_random_uuid(),
        'deposit',
        p.amount,
        0,
        p.amount,
        p.id,
        p."userId",
        'Starter credits (migrated)',
        p."createdAt"
      FROM "payments" p
      WHERE p.method = 'credits'
        AND p.type = 'deposit'
        AND p.description = 'Starter credits'
        AND NOT EXISTS (
          SELECT 1 FROM "transactions" t WHERE t."paymentId" = p.id::text
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "transactions"
      WHERE note = 'Starter credits (migrated)'
    `);
  }
}
