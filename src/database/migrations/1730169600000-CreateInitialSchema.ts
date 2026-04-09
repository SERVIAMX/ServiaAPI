import * as fs from 'fs';
import * as path from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1730169600000 implements MigrationInterface {
  name = 'CreateInitialSchema1730169600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      await queryRunner.query(stmt);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryRunner.query('DROP TABLE IF EXISTS `RolePermissions`');
    await queryRunner.query('DROP TABLE IF EXISTS `Permissions`');
    await queryRunner.query('DROP TABLE IF EXISTS `AppModules`');
    await queryRunner.query('DROP TABLE IF EXISTS `RefreshTokens`');
    await queryRunner.query('DROP TABLE IF EXISTS `Users`');
    await queryRunner.query('DROP TABLE IF EXISTS `Roles`');
    await queryRunner.query('DROP TABLE IF EXISTS `Clients`');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}
