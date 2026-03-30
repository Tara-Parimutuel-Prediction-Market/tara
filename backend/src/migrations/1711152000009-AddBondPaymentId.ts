import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBondPaymentId1711152000009 implements MigrationInterface {
    name = 'AddBondPaymentId1711152000009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disputes" ADD "bondPaymentId" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "bondPaymentId"`);
    }
}
