import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSCPMColumns1711152000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bets" DROP COLUMN IF EXISTS "shares"`);
    await queryRunner.query(`ALTER TABLE "bets" DROP COLUMN IF EXISTS "limitPrice"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bets" ADD COLUMN "shares" numeric(18,4)`);
    await queryRunner.query(`ALTER TABLE "bets" ADD COLUMN "limitPrice" numeric(10,6)`);
  }
}
