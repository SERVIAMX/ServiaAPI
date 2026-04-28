import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameClientsLineCreditToCreditLine1760920200000
  implements MigrationInterface
{
  name = 'RenameClientsLineCreditToCreditLine1760920200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`Clients\`
      CHANGE COLUMN \`LineCredit\` \`CreditLine\` DECIMAL(10,2) NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`Clients\`
      CHANGE COLUMN \`CreditLine\` \`LineCredit\` DECIMAL(10,2) NULL DEFAULT NULL
    `);
  }
}

