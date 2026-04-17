import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCardInventoryDefault1775990000006 implements MigrationInterface {
  name = "FixCardInventoryDefault1775990000006";

  async up(queryRunner: QueryRunner): Promise<void> {
    // The original CreateUsersTable migration set DEFAULT '[]' (an array) instead of
    // a proper object. Fix existing rows where cardInventory is an empty JSON array.
    await queryRunner.query(`
      UPDATE "users"
      SET "cardInventory" = '{"doubleDown":0,"shield":0,"ghost":0}'::jsonb
      WHERE "cardInventory" = '[]'::jsonb
         OR "cardInventory" IS NULL
    `);

    // Ensure future rows default to a valid object, not an array
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "cardInventory" SET DEFAULT '{"doubleDown":0,"shield":0,"ghost":0}'::jsonb
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "cardInventory" SET DEFAULT '[]'::jsonb
    `);
  }
}
