import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterBalanceHistoryAddIsPaid1760920400000
  implements MigrationInterface
{
  name = 'AlterBalanceHistoryAddIsPaid1760920400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`BalanceHistory\`
      ADD COLUMN \`IsPaid\` TINYINT NULL AFTER \`TransactionType\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`BalanceHistory\`
      DROP COLUMN \`IsPaid\`
    `);
  }
}

