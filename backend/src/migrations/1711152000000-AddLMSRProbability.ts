import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddLMSRProbability1711152000000 implements MigrationInterface {
  name = "AddLMSRProbability1711152000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add lmsrProbability column to outcomes table if it doesn't exist
    const hasColumn = await queryRunner.hasColumn("outcomes", "lmsrProbability");
    if (!hasColumn) {
      await queryRunner.addColumn(
        "outcomes",
        new TableColumn({
          name: "lmsrProbability",
          type: "decimal",
          precision: 10,
          scale: 6,
          default: 0,
          isNullable: false,
        }),
      );
    }

    // Initialize existing outcomes with equal probabilities
    // Get all markets with their outcome counts
    const markets = await queryRunner.query(`
      SELECT m.id, COUNT(o.id) as outcome_count
      FROM markets m
      LEFT JOIN outcomes o ON o."marketId" = m.id
      GROUP BY m.id
    `);

    // Set equal probabilities for each market
    for (const market of markets) {
      if (market.outcome_count > 0) {
        const equalProb = 1.0 / market.outcome_count;
        await queryRunner.query(
          `
          UPDATE outcomes
          SET "lmsrProbability" = $1
          WHERE "marketId" = $2
        `,
          [equalProb, market.id],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove lmsrProbability column
    await queryRunner.dropColumn("outcomes", "lmsrProbability");
  }
}
