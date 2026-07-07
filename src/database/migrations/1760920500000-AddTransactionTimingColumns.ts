import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionTimingColumns1760920500000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`Transactions\`
      ADD COLUMN \`VentaDurationSeconds\` DECIMAL(10,2) NULL AFTER \`FHUpdate\`,
      ADD COLUMN \`FHCheckStatus\` TIMESTAMP NULL AFTER \`VentaDurationSeconds\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`TransactionsHistory\`
      ADD COLUMN \`VentaDurationSeconds\` DECIMAL(10,2) NULL AFTER \`FHUpdate\`,
      ADD COLUMN \`FHCheckStatus\` TIMESTAMP NULL AFTER \`VentaDurationSeconds\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`Transactions\`
      DROP COLUMN \`FHCheckStatus\`,
      DROP COLUMN \`VentaDurationSeconds\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`TransactionsHistory\`
      DROP COLUMN \`FHCheckStatus\`,
      DROP COLUMN \`VentaDurationSeconds\`
    `);
  }
}
