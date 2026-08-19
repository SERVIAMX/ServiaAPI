import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'node:crypto';
import { Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { ReferenceCode } from './entities/reference-code.entity';

const CODE_LENGTH = 8;
const MAX_GENERATION_ATTEMPTS = 25;

@Injectable()
export class ReferencesCodesService {
  constructor(
    @InjectRepository(ReferenceCode)
    private readonly referenceCodeRepo: Repository<ReferenceCode>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  private generateNumericCode(): string {
    return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
  }

  async generateForClient(clientId: number): Promise<{ code: string }> {
    if (!clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const code = this.generateNumericCode();
      const exists = await this.referenceCodeRepo.exists({ where: { code } });
      if (exists) continue;

      try {
        const row = this.referenceCodeRepo.create({
          code,
          customer: { id: clientId } as Client,
          estatus: 1,
        });
        await this.referenceCodeRepo.save(row);
        return { code };
      } catch {
        // Colisión concurrente en índice UNIQUE
        continue;
      }
    }

    throw new ConflictException(
      'No se pudo generar un código único. Intenta de nuevo.',
    );
  }
}
