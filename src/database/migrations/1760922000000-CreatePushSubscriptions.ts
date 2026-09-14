import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushSubscriptions1760922000000 implements MigrationInterface {
  name = 'CreatePushSubscriptions1760922000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`PushSubscriptions\` (
        \`Id\` BIGINT NOT NULL AUTO_INCREMENT,
        \`UserId\` BIGINT NOT NULL,
        \`ClientId\` BIGINT NOT NULL,
        \`Endpoint\` VARCHAR(500) NOT NULL,
        \`P256dh\` VARCHAR(255) NOT NULL,
        \`Auth\` VARCHAR(255) NOT NULL,
        \`TimeZone\` VARCHAR(64) NOT NULL DEFAULT 'America/Mexico_City',
        \`CreatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`LastSentAt\` DATETIME NULL,
        PRIMARY KEY (\`Id\`),
        UNIQUE INDEX \`UQ_PushSubscriptions_Endpoint\` (\`Endpoint\` ASC),
        INDEX \`IX_PushSubscriptions_UserId\` (\`UserId\` ASC),
        INDEX \`IX_PushSubscriptions_ClientId\` (\`ClientId\` ASC),
        CONSTRAINT \`FK_PushSubscriptions_Users\`
          FOREIGN KEY (\`UserId\`)
          REFERENCES \`Users\` (\`Id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT \`FK_PushSubscriptions_Clients\`
          FOREIGN KEY (\`ClientId\`)
          REFERENCES \`Clients\` (\`Id\`)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `PushSubscriptions`');
  }
}
