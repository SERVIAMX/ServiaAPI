import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerBalance1760918400000 implements MigrationInterface {
  name = 'CreateCustomerBalance1760918400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`CustomerBalance\` (
        \`Id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`CustomerId\` BIGINT NULL,
        \`CreditBalance\` DECIMAL(12,2) NOT NULL DEFAULT 0,
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de registro (CST México)',
        \`UpdatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización (CST México)',
        PRIMARY KEY (\`Id\`),
        INDEX \`FK_CBalance_Client_idx\` (\`CustomerId\` ASC) VISIBLE,
        CONSTRAINT \`FK_CBalance_Client\`
          FOREIGN KEY (\`CustomerId\`)
          REFERENCES \`Clients\` (\`Id\`)
          ON DELETE NO ACTION
          ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `CustomerBalance`');
  }
}

