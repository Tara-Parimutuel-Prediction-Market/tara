import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutcomeImageUrl1776075295299 implements MigrationInterface {
  name = "AddOutcomeImageUrl1776075295299";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_otps" DROP CONSTRAINT IF EXISTS "FK_payment_otps_dispute"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" DROP CONSTRAINT IF EXISTS "FK_payment_otps_market"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" DROP CONSTRAINT IF EXISTS "FK_payment_otps_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" DROP CONSTRAINT IF EXISTS "FK_payment_otps_payment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "challenges" DROP CONSTRAINT IF EXISTS "FK_challenges_joinerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" DROP CONSTRAINT IF EXISTS "FK_group_memberships_user"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payment_otps_paymentId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payment_otps_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payment_otps_marketId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payment_otps_disputeId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_audit_logs_adminId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_seasons_year_week"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_group_memberships_chatId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" DROP CONSTRAINT IF EXISTS "UQ_group_memberships_chatId_userId"`,
    );
    // Skip renaming totalBetAmount to imageUrl since imageUrl already exists in the table
    // Just drop totalBetAmount if it exists
    await queryRunner.query(
      `ALTER TABLE "outcomes" DROP COLUMN IF EXISTS "totalBetAmount"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum" RENAME TO "transactions_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('deposit', 'withdrawal', 'bet_placed', 'bet_payout', 'refund', 'dispute_bond', 'dispute_refund', 'referral_bonus', 'free_credit', 'streak_bonus', 'referral_prize')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "public"."transactions_type_enum" USING "type"::"text"::"public"."transactions_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "payment_otps" ALTER COLUMN "expiresAt" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "roleType" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "seasons" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "seasons" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5d785861562edb80c4ee4137d5" ON "group_memberships" ("chatId", "userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "challenges" ADD CONSTRAINT "FK_7b937109deaa8f1631d0411881d" FOREIGN KEY ("joinerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_ae52b7a8e0e084d7945522ef762" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "group_memberships" DROP CONSTRAINT IF EXISTS "FK_ae52b7a8e0e084d7945522ef762"`,
    );
    await queryRunner.query(
      `ALTER TABLE "challenges" DROP CONSTRAINT IF EXISTS "FK_7b937109deaa8f1631d0411881d"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_5d785861562edb80c4ee4137d5"`,
    );
    await queryRunner.query(`ALTER TABLE "seasons" DROP COLUMN "createdAt"`);
    await queryRunner.query(
      `ALTER TABLE "seasons" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "roleType" SET DEFAULT 'admin'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" ALTER COLUMN "expiresAt" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum_old" AS ENUM('deposit', 'withdrawal', 'bet_placed', 'bet_payout', 'refund', 'dispute_bond', 'dispute_refund', 'referral_bonus', 'free_credit', 'streak_bonus', 'tournament_prize', 'referral_prize')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "public"."transactions_type_enum_old" USING "type"::"text"::"public"."transactions_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."transactions_type_enum_old" RENAME TO "transactions_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "outcomes" DROP COLUMN "imageUrl"`);
    await queryRunner.query(
      `ALTER TABLE "outcomes" ADD "imageUrl" numeric(18,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "outcomes" RENAME COLUMN "imageUrl" TO "totalBetAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" ADD CONSTRAINT "UQ_group_memberships_chatId_userId" UNIQUE ("chatId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_group_memberships_chatId" ON "group_memberships" ("chatId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_seasons_year_week" ON "seasons" ("weekNumber", "year") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_adminId" ON "audit_logs" ("adminId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_otps_disputeId" ON "payment_otps" ("disputeId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_otps_marketId" ON "payment_otps" ("marketId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_otps_userId" ON "payment_otps" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_otps_paymentId" ON "payment_otps" ("paymentId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_group_memberships_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "challenges" ADD CONSTRAINT "FK_challenges_joinerId" FOREIGN KEY ("joinerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" ADD CONSTRAINT "FK_payment_otps_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" ADD CONSTRAINT "FK_payment_otps_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" ADD CONSTRAINT "FK_payment_otps_market" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_otps" ADD CONSTRAINT "FK_payment_otps_dispute" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
