import { MigrationInterface, QueryRunner } from "typeorm";

export class RecreateTransactionsAndFixPayments1711152000007
  implements MigrationInterface
{
  name = "RecreateTransactionsAndFixPayments1711152000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Recreate transactions table with correct schema
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" varchar NOT NULL,
        "amount" numeric(20,9) NOT NULL,
        "balanceBefore" numeric(20,9) NOT NULL,
        "balanceAfter" numeric(20,9) NOT NULL,
        "paymentId" uuid,
        "betId" uuid,
        "note" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_userId" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transactions_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id"),
        CONSTRAINT "FK_transactions_betId" FOREIGN KEY ("betId") REFERENCES "bets" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_paymentId" ON transactions ("paymentId")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_betId" ON transactions ("betId")`
    );

    // 2. Add unique constraint to payments.externalPaymentId
    await queryRunner.query(`
      ALTER TABLE payments
      ADD CONSTRAINT "UQ_payments_externalPaymentId" UNIQUE ("externalPaymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove unique constraint from payments
    await queryRunner.query(`
      ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS "UQ_payments_externalPaymentId"
    `);

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_transactions_paymentId"`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_betId"`);

    // Drop transactions table
    await queryRunner.query(`DROP TABLE IF EXISTS "transactions"`);
  }
}
