import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterCustomerBalanceAddBalance1760920100000
  implements MigrationInterface
{
  name = 'AlterCustomerBalanceAddBalance1760920100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`CustomerBalance\`
      ADD COLUMN \`Balance\` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER \`CreditBalance\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`CustomerBalance\`
      DROP COLUMN \`Balance\`
    `);
  }
}

