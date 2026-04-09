import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDisputesTable1711100000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disputes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bondAmount" numeric(18,2) NOT NULL,
        "reason" text,
        "bondPaymentId" uuid,
        "bondRefunded" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "marketId" uuid NOT NULL,
        CONSTRAINT "PK_disputes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_disputes_userId" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_disputes_marketId" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_userId" ON "disputes" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_marketId" ON "disputes" ("marketId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes"`);
  }
}
