import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterCustomerBalanceIdAutoIncrement1760918460000
  implements MigrationInterface
{
  name = 'AlterCustomerBalanceIdAutoIncrement1760918460000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`CustomerBalance\`
      CHANGE COLUMN \`Id\` \`Id\` BIGINT NOT NULL AUTO_INCREMENT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`CustomerBalance\`
      CHANGE COLUMN \`Id\` \`Id\` BIGINT NOT NULL
    `);
  }
}

