import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentTable1711152000001 implements MigrationInterface {
  name = "CreatePaymentTable1711152000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enums
    await queryRunner.query(`
      CREATE TYPE "public"."payments_type_enum" AS ENUM('deposit', 'withdrawal', 'bet_placed', 'bet_payout', 'refund')
    `);
    
    await queryRunner.query(`
      CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'success', 'failed', 'cancelled')
    `);
    
    await queryRunner.query(`
      CREATE TYPE "public"."payments_method_enum" AS ENUM('dkbank', 'ton', 'credits')
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "public"."payments_type_enum" NOT NULL,
        "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending',
        "method" "public"."payments_method_enum" NOT NULL,
        "amount" decimal(18,2) NOT NULL,
        "currency" varchar(10) NOT NULL DEFAULT 'BTN',
        "balancebefore" decimal(18,2),
        "balanceafter" decimal(18,2),
        "externalpaymentid" varchar,
        "referenceid" varchar,
        "customerphone" varchar,
        "description" varchar,
        "metadata" json,
        "failurereason" varchar,
        "confirmedat" timestamp,
        "createdat" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedat" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userid" uuid NOT NULL,
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);

    // Create foreign key constraint
    await queryRunner.query(`
      ALTER TABLE payments 
      ADD CONSTRAINT "FK_payments_userId" 
      FOREIGN KEY ("userid") 
      REFERENCES users(id) 
      ON DELETE CASCADE
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_payments_userId" ON payments ("userid")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON payments ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_method" ON payments ("method")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_createdAt" ON payments ("createdat")`);

    // Migrate data from transactions table if it exists
    const hasTransactionsTable = await queryRunner.hasTable("transactions");
    if (hasTransactionsTable) {
      await queryRunner.query(`
        INSERT INTO payments (
          id, type, status, method, amount, currency, 
          balancebefore, balanceafter, referenceid, 
          description, createdat, userid
        )
        SELECT 
          id, 
          type::text::payments_type_enum, 
          'success'::payments_status_enum as status,
          'credits'::payments_method_enum as method,
          amount,
          'CREDITS' as currency,
          "balanceBefore",
          "balanceAfter",
          "referenceId",
          note as description,
          "createdAt",
          "userId"
        FROM transactions
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_method"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_createdAt"`);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE payments 
      DROP CONSTRAINT IF EXISTS "FK_payments_userId"
    `);

    // Drop table
    await queryRunner.dropTable("payments");

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payments_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payments_method_enum"`);
  }
}
