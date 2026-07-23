import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Role } from '../roles/entities/role.entity';

const KEY_PAUSED = 'servia:tx:paused';

@Injectable()
export class TransactionGateService {
  private readonly logger = new Logger(TransactionGateService.name);
  private readonly administratorRoleId = 1;

  /** Fallback si no hay Redis (una sola instancia). */
  private memoryPaused = false;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  backend(): 'redis' | 'memory' {
    return this.redis ? 'redis' : 'memory';
  }

  async assertPrivilegedAdmin(roleId: number): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new ForbiddenException('Sin rol asignado');
    const nameNorm = role.name?.trim().toLowerCase() ?? '';
    const allowed = new Set(['super administrador', 'administrador']);
    if (!allowed.has(nameNorm) && role.id !== this.administratorRoleId) {
      throw new ForbiddenException(
        'Solo Super Administrador o Administrador pueden controlar el gate de transacciones',
      );
    }
  }

  async isPaused(): Promise<boolean> {
    if (this.redis) {
      try {
        const v = await this.redis.get(KEY_PAUSED);
        return v === '1' || v === 'true';
      } catch (err) {
        this.logger.error(
          `Redis get paused falló, usando memoria: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return this.memoryPaused;
  }

  async setPaused(
    paused: boolean,
  ): Promise<{ paused: boolean; backend: string }> {
    this.memoryPaused = paused;
    if (this.redis) {
      try {
        if (paused) {
          await this.redis.set(KEY_PAUSED, '1');
        } else {
          await this.redis.del(KEY_PAUSED);
        }
      } catch (err) {
        this.logger.error(
          `Redis set paused falló: ${err instanceof Error ? err.message : err}`,
        );
        throw new ServiceUnavailableException(
          'No se pudo actualizar el flag en Redis',
        );
      }
    }
    this.logger.warn(
      `Transactions gate paused=${paused} backend=${this.backend()}`,
    );
    return { paused, backend: this.backend() };
  }

  async getStatus(): Promise<{
    paused: boolean;
    backend: 'redis' | 'memory';
  }> {
    return {
      paused: await this.isPaused(),
      backend: this.backend(),
    };
  }

  /** Rechaza ventas si el interruptor global está activo. */
  async assertNotPaused(): Promise<void> {
    if (await this.isPaused()) {
      throw new ServiceUnavailableException(
        'Las transacciones están temporalmente pausadas. Intenta más tarde.',
      );
    }
  }
}
