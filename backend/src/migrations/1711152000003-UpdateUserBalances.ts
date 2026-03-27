import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserBalances1711152000003 implements MigrationInterface {
  name = "UpdateUserBalances1711152000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new balance columns
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN "creditsBalance" decimal(18,2) NOT NULL DEFAULT 1000
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN "btnBalance" decimal(18,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN "usdtBalance" decimal(18,6) NOT NULL DEFAULT 0
    `);

    // Migrate existing balance data to creditsBalance
    await queryRunner.query(`
      UPDATE users 
      SET "creditsBalance" = balance
      WHERE balance IS NOT NULL
    `);

    // Drop the old balance column
    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN "balance"
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_users_creditsBalance" ON users ("creditsBalance")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_btnBalance" ON users ("btnBalance")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_usdtBalance" ON users ("usdtBalance")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_creditsBalance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_btnBalance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_usdtBalance"`);

    // Add back the old balance column
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN "balance" decimal(18,2) NOT NULL DEFAULT 1000
    `);

    // Migrate data back from creditsBalance to balance
    await queryRunner.query(`
      UPDATE users 
      SET "balance" = "creditsBalance"
    `);

    // Drop the new balance columns
    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN "creditsBalance"
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN "btnBalance"
    `);

    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN "usdtBalance"
    `);
  }
}
