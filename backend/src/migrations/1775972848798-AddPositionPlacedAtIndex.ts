import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPositionPlacedAtIndex1775972848798 implements MigrationInterface {
  name = "AddPositionPlacedAtIndex1775972848798";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints if they exist
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_ca8cf669d26fbfcc365a4811b22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_a3c43ce1fc761d6d0a4b206449c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_cc3b868c15ba2f88702f9a2866e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_positionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_disputes_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_disputes_marketId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_auth_methods_provider_providerId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_outcomes_marketId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_markets_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_b2e520de4bcc291a7fd215f1dd"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_positions_userId_marketId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payments_externalPaymentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_2756723e1cddcdb37f3a37ebb4"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transactions_positionId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transactions_paymentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_transactions_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_users_telegramChatId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_telegramId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_username"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_dkCid"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_dkAccountNumber"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_telegramChatId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_disputes_marketId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_disputes_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_dk_gateway_auth_tokens_accesstoken"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_dk_gateway_auth_tokens_expiresat"`,
    );
    await queryRunner.query(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'markets_mechanism_enum') THEN
              ALTER TYPE "public"."markets_mechanism_enum" RENAME TO "markets_mechanism_enum_old";
            END IF;
          END $$
        `);
    await queryRunner.query(`
          DO $$ BEGIN
            CREATE TYPE "public"."markets_mechanism_enum" AS ENUM('parimutuel');
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$
        `);
    await queryRunner.query(
      `ALTER TABLE "markets" ALTER COLUMN "mechanism" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ALTER COLUMN "mechanism" TYPE "public"."markets_mechanism_enum" USING "mechanism"::"text"::"public"."markets_mechanism_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ALTER COLUMN "mechanism" SET DEFAULT 'parimutuel'`,
    );
    await queryRunner.query(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'markets_mechanism_enum_old') THEN
              DROP TYPE "public"."markets_mechanism_enum_old";
            END IF;
          END $$
        `);
    await queryRunner.query(
      `ALTER TABLE "markets" DROP COLUMN "resolvedOutcomeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ADD "resolvedOutcomeId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" DROP COLUMN "proposedOutcomeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ADD "proposedOutcomeId" uuid`,
    );
    // Rename old enum only if it still exists (guard for re-runs)
    await queryRunner.query(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bets_status_enum') THEN
              ALTER TYPE "public"."bets_status_enum" RENAME TO "bets_status_enum_old";
            END IF;
          END $$
        `);
    // Create new enum only if it doesn't already exist
    await queryRunner.query(`
          DO $$ BEGIN
            CREATE TYPE "public"."positions_status_enum" AS ENUM('pending', 'won', 'lost', 'refunded');
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$
        `);
    await queryRunner.query(
      `ALTER TABLE "positions" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ALTER COLUMN "status" TYPE "public"."positions_status_enum" USING "status"::"text"::"public"."positions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    // Drop old enum only if it still exists
    await queryRunner.query(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bets_status_enum_old') THEN
              DROP TYPE "public"."bets_status_enum_old";
            END IF;
          END $$
        `);
    await queryRunner.query(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_type_enum') THEN
              ALTER TYPE "public"."payments_type_enum" RENAME TO "payments_type_enum_old";
            END IF;
          END $$
        `);
    await queryRunner.query(`
          DO $$ BEGIN
            CREATE TYPE "public"."payments_type_enum" AS ENUM('deposit', 'withdrawal', 'position_placed', 'position_payout', 'refund');
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$
        `);
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "type" TYPE "public"."payments_type_enum" USING "type"::"text"::"public"."payments_type_enum"`,
    );
    await queryRunner.query(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payments_type_enum_old') THEN
              DROP TYPE "public"."payments_type_enum_old";
            END IF;
          END $$
        `);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "confirmedAt"`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "confirmedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_721af04ac41f7598ecb59f5e66"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "paymentId"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ADD "paymentId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_1eb2bfb05045660f5c286356413" UNIQUE ("telegramChatId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "reputationTier" SET DEFAULT 'rookie'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_933827dc83a6e08eb13e4dc8ce" ON "positions" ("placedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c766089a2073274555d9c7483" ON "positions" ("userId", "marketId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_721af04ac41f7598ecb59f5e66" ON "transactions" ("paymentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_26d3ddc08f3ca2799c6b5ac4d3" ON "transactions" ("positionId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1eb2bfb05045660f5c28635641" ON "users" ("telegramChatId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_0cf2caecfba00a6746ec1ff87a3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_ba6a0153ab467b9ec02765d48f0" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_88182c148db063015346795a5ed" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_f49c7610167b5a0754f72ab5e34" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_4074d1c69ba6b998dcbe6be98e3" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_4074d1c69ba6b998dcbe6be98e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP CONSTRAINT IF EXISTS "FK_f49c7610167b5a0754f72ab5e34"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_88182c148db063015346795a5ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_ba6a0153ab467b9ec02765d48f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_0cf2caecfba00a6746ec1ff87a3"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_1eb2bfb05045660f5c28635641"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_26d3ddc08f3ca2799c6b5ac4d3"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_721af04ac41f7598ecb59f5e66"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_8c766089a2073274555d9c7483"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_933827dc83a6e08eb13e4dc8ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "reputationTier" SET DEFAULT 'newcomer'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_1eb2bfb05045660f5c286356413"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "paymentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "paymentId" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_721af04ac41f7598ecb59f5e66" ON "transactions" ("paymentId") `,
    );
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "confirmedAt"`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "confirmedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_type_enum_old" AS ENUM('deposit', 'withdrawal', 'bet_placed', 'bet_payout', 'refund')`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "type" TYPE "public"."payments_type_enum_old" USING "type"::"text"::"public"."payments_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."payments_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."payments_type_enum_old" RENAME TO "payments_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bets_status_enum_old" AS ENUM('pending', 'won', 'lost', 'refunded')`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ALTER COLUMN "status" TYPE "public"."bets_status_enum_old" USING "status"::"text"::"public"."bets_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."positions_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."bets_status_enum_old" RENAME TO "bets_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" DROP COLUMN "proposedOutcomeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ADD "proposedOutcomeId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" DROP COLUMN "resolvedOutcomeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ADD "resolvedOutcomeId" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."markets_mechanism_enum_old" AS ENUM('parimutuel', 'scpm')`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ALTER COLUMN "mechanism" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ALTER COLUMN "mechanism" TYPE "public"."markets_mechanism_enum_old" USING "mechanism"::"text"::"public"."markets_mechanism_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "markets" ALTER COLUMN "mechanism" SET DEFAULT 'parimutuel'`,
    );
    await queryRunner.query(`DROP TYPE "public"."markets_mechanism_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."markets_mechanism_enum_old" RENAME TO "markets_mechanism_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dk_gateway_auth_tokens_expiresat" ON "dk_gateway_auth_tokens" ("expiresat") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dk_gateway_auth_tokens_accesstoken" ON "dk_gateway_auth_tokens" ("accesstoken") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_disputes_userId" ON "disputes" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_disputes_marketId" ON "disputes" ("marketId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_telegramChatId" ON "users" ("telegramChatId") WHERE ("telegramChatId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_dkAccountNumber" ON "users" ("dkAccountNumber") WHERE ("dkAccountNumber" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_dkCid" ON "users" ("dkCid") WHERE ("dkCid" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_username" ON "users" ("username") WHERE (username IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_telegramId" ON "users" ("telegramId") WHERE ("telegramId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_telegramChatId" ON "users" ("telegramChatId") WHERE ("telegramChatId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_userId" ON "transactions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_paymentId" ON "transactions" ("paymentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_positionId" ON "transactions" ("positionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2756723e1cddcdb37f3a37ebb4" ON "transactions" ("positionId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_payments_externalPaymentId" ON "payments" ("externalPaymentId") WHERE ("externalPaymentId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_positions_userId_marketId" ON "positions" ("userId", "marketId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2e520de4bcc291a7fd215f1dd" ON "positions" ("userId", "marketId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_markets_status" ON "markets" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outcomes_marketId" ON "outcomes" ("marketId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_auth_methods_provider_providerId" ON "auth_methods" ("provider", "providerId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_disputes_marketId" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD CONSTRAINT "FK_disputes_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_positionId" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_cc3b868c15ba2f88702f9a2866e" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_a3c43ce1fc761d6d0a4b206449c" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "positions" ADD CONSTRAINT "FK_ca8cf669d26fbfcc365a4811b22" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
