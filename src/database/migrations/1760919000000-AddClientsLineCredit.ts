import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientsLineCredit1760919000000 implements MigrationInterface {
  name = 'AddClientsLineCredit1760919000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`Clients\`
      ADD COLUMN \`LineCredit\` DECIMAL(10,2) NULL AFTER \`DeletedAt\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`Clients\`
      DROP COLUMN \`LineCredit\`
    `);
  }
}

