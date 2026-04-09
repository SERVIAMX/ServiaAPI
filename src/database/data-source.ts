import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PascalCaseNamingStrategy } from './pascal-case-naming.strategy';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'servia_api',
  timezone: process.env.DB_TIMEZONE || '-06:00',
  charset: 'utf8mb4',
  namingStrategy: new PascalCaseNamingStrategy(),
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, './migrations/*{.ts,.js}')],
});
