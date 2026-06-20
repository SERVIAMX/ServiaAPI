import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { PascalCaseNamingStrategy } from '../database/pascal-case-naming.strategy';

export function createTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  const connectionLimit = config.get<number>('DB_POOL_LIMIT', 10);

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
    /** Pool mysql2: evita acumular conexiones Sleep sin límite. */
    extra: {
      connectionLimit,
      maxIdle: Math.min(5, connectionLimit),
      idleTimeout: 30_000,
      waitForConnections: true,
      queueLimit: 50,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
    },
  };
}
