import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTransactionTable1711152000002 implements MigrationInterface {
  name = "DropTransactionTable1711152000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if transactions table exists before dropping
    const hasTransactionsTable = await queryRunner.hasTable("transactions");
    if (hasTransactionsTable) {
      // Drop foreign key constraint first
      await queryRunner.query(`
        ALTER TABLE transactions 
        DROP CONSTRAINT IF EXISTS "FK_transactions_userId"
      `);

      // Drop the transactions table
      await queryRunner.dropTable("transactions");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate transactions table (for rollback)
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" enum NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "balanceBefore" numeric(18,2) NOT NULL,
        "balanceAfter" numeric(18,2) NOT NULL,
        "referenceId" character varying,
        "note" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_userId" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_transactions_userId" ON transactions ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_createdAt" ON transactions ("createdAt")`);

    // Migrate data back from payments table if it exists
    const hasPaymentsTable = await queryRunner.hasTable("payments");
    if (hasPaymentsTable) {
      await queryRunner.query(`
        INSERT INTO transactions (
          id, type, amount, balanceBefore, balanceAfter, 
          referenceId, note, createdAt, userId
        )
        SELECT 
          id, 
          type, 
          amount,
          balanceBefore,
          balanceAfter,
          referenceId,
          description as note,
          createdAt,
          userId
        FROM payments
        WHERE method = 'credits'
      `);
    }
  }
}
