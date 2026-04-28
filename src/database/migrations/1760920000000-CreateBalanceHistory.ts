import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBalanceHistory1760920000000 implements MigrationInterface {
  name = 'CreateBalanceHistory1760920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`BalanceHistory\` (
        \`Id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`CustomerId\` BIGINT NULL,
        \`Amount\` DECIMAL(10,2) NULL,
        \`FHRegistro\` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
        \`TransactionType\` TINYINT NULL COMMENT '1 Pagado 2 Credito',
        PRIMARY KEY (\`Id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `BalanceHistory`');
  }
}

