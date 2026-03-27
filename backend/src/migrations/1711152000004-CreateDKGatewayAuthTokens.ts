import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDKGatewayAuthTokens1711152000004 implements MigrationInterface {
  name = "CreateDKGatewayAuthTokens1711152000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dk_gateway_auth_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accesstoken" text NOT NULL,
        "refreshtoken" text,
        "expiresat" timestamp NOT NULL,
        "createdat" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedat" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_dk_gateway_auth_tokens" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dk_gateway_auth_tokens_expiresat" ON dk_gateway_auth_tokens ("expiresat")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dk_gateway_auth_tokens_expiresat"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dk_gateway_auth_tokens"`);
  }
}

