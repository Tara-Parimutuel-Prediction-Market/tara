import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds phone-verification columns to the `users` table.
 *
 * New columns:
 *  - telegramChatId      — Telegram chat_id bound during phone-verification handshake
 *  - telegramPhoneHash   — HMAC-SHA-256 hash of the Telegram-shared phone number
 *  - dkPhoneHash         — HMAC-SHA-256 hash of the DK Bank registered phone number
 *  - telegramLinkedAt    — Timestamp of successful phone verification
 */
export class AddTelegramPhoneVerification1711152000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "telegramChatId"    VARCHAR    DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "telegramPhoneHash" VARCHAR    DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "dkPhoneHash"       VARCHAR    DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "telegramLinkedAt"  TIMESTAMPTZ DEFAULT NULL
    `);

    // Unique index on telegramChatId — one Telegram account per Tara account
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_telegramChatId"
        ON "users" ("telegramChatId")
        WHERE "telegramChatId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_telegramChatId"`);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "telegramLinkedAt",
        DROP COLUMN IF EXISTS "dkPhoneHash",
        DROP COLUMN IF EXISTS "telegramPhoneHash",
        DROP COLUMN IF EXISTS "telegramChatId"
    `);
  }
}
