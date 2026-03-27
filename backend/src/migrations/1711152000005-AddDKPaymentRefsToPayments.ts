import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDKPaymentRefsToPayments1711152000005 implements MigrationInterface {
  name = "AddDKPaymentRefsToPayments1711152000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS "dkinquiryid" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS "dktxnstatusid" varchar
    `);

    await queryRunner.query(`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS "dkrequestid" varchar
    `);

    // Indexes for faster callback lookup
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_dkinquiryid" ON payments ("dkinquiryid")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_dktxnstatusid" ON payments ("dktxnstatusid")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_dkinquiryid"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_dktxnstatusid"`);

    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS "dkinquiryid"`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS "dktxnstatusid"`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS "dkrequestid"`);
  }
}

