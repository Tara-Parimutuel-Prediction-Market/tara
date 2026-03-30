import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisputeTransactionTypes1711152000010 implements MigrationInterface {
    name = 'AddDisputeTransactionTypes1711152000010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'dispute_bond'`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'dispute_refund'`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support removing enum values directly
    }
}
