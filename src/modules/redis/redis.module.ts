import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL')?.trim();
    const host = config.get<string>('REDIS_HOST')?.trim();
    if (!url && !host) {
      this.logger.warn(
        'Redis no configurado (REDIS_URL / REDIS_HOST). Transaction gate usará memoria local.',
      );
      this.client = null;
      return;
    }

    this.client = url
      ? new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true })
      : new Redis({
          host: host || '127.0.0.1',
          port: parseInt(config.get<string>('REDIS_PORT') || '6379', 10),
          password: config.get<string>('REDIS_PASSWORD')?.trim() || undefined,
          db: parseInt(config.get<string>('REDIS_DB') || '0', 10),
          maxRetriesPerRequest: 2,
          lazyConnect: true,
        });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    void this.client
      .connect()
      .then(() => this.logger.log('Redis conectado'))
      .catch((err: unknown) =>
        this.logger.error(
          `No se pudo conectar a Redis: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    {
      provide: REDIS_CLIENT,
      inject: [RedisService],
      useFactory: (svc: RedisService) => svc.client,
    },
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
