import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { PascalCaseNamingStrategy } from '../database/pascal-case-naming.strategy';

export function createTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 3306),
    username: config.get<string>('DB_USERNAME', 'root'),
    password: config.get<string>('DB_PASSWORD', ''),
    database: config.get<string>('DB_NAME', 'servia_api'),
    timezone: config.get<string>('DB_TIMEZONE', '-06:00'),
    charset: 'utf8mb4',
    namingStrategy: new PascalCaseNamingStrategy(),
    synchronize: false,
    logging: config.get<string>('DB_LOGGING') === 'true',
    autoLoadEntities: true,
    migrations: [__dirname + '/../database/migrations/*.js'],
    migrationsRun: false,
  };
}
