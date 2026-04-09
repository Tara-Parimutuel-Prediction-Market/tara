import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1711100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "telegramId" character varying,
        "telegramStreak" integer,
        "firstName" character varying,
        "lastName" character varying,
        "username" character varying,
        "photoUrl" character varying,
        "isAdmin" boolean NOT NULL DEFAULT false,
        "dkCid" character varying,
        "dkAccountNumber" character varying,
        "dkAccountName" character varying,
        "phoneNumber" character varying,
        "telegramChatId" character varying,
        "telegramPhoneHash" character varying,
        "dkPhoneHash" character varying,
        "telegramLinkedAt" TIMESTAMP WITH TIME ZONE,
        "reputationScore" numeric(5,4),
        "reputationTier" character varying NOT NULL DEFAULT 'newcomer',
        "totalPredictions" integer NOT NULL DEFAULT 0,
        "correctPredictions" integer NOT NULL DEFAULT 0,
        "categoryScores" jsonb,
        "brierScore" numeric(5,4),
        "brierCount" integer NOT NULL DEFAULT 0,
        "lastActiveAt" TIMESTAMP WITH TIME ZONE,
        "contrarianWins" integer NOT NULL DEFAULT 0,
        "contrarianAttempts" integer NOT NULL DEFAULT 0,
        "contrarianBadge" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_telegramId" ON "users" ("telegramId") WHERE "telegramId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username") WHERE "username" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_dkCid" ON "users" ("dkCid") WHERE "dkCid" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_dkAccountNumber" ON "users" ("dkAccountNumber") WHERE "dkAccountNumber" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_telegramChatId" ON "users" ("telegramChatId") WHERE "telegramChatId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
