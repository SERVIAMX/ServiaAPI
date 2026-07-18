import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';
import {
  AUDIT_OPERATION,
  RecordAuditLogInput,
} from './audit-log.types';
import { BitacoraGateway } from './bitacora.gateway';
import { FilterAuditLogDto } from './dto/filter-audit-log.dto';
import { OperationAuditLog } from './entities/operation-audit-log.entity';

function parseRangeStart(raw: string): Date {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000`);
  return new Date(s);
}

function parseRangeEnd(raw: string): Date {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59.999`);
  return new Date(s);
}

function formatAmount(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n.toFixed(2);
}

function clientLabel(c: Client | null | undefined): string | null {
  if (!c) return null;
  const name =
    c.tradeName?.trim() ||
    c.businessName?.trim() ||
    `Cliente ${c.id}`;
  return `${name} (${c.id})`;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(OperationAuditLog)
    private readonly auditRepo: Repository<OperationAuditLog>,
    @Optional() private readonly bitacoraGateway?: BitacoraGateway,
  ) {}

  /** Registra operación sin interrumpir el flujo principal si falla el INSERT. */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      const row = this.auditRepo.create({
        operationType: input.operationType,
        status: input.status,
        client:
          input.clientId != null && input.clientId > 0
            ? ({ id: input.clientId } as Client)
            : null,
        user:
          input.userId != null && input.userId > 0
            ? ({ id: input.userId } as User)
            : null,
        referenceId: input.referenceId?.trim() || null,
        amount: formatAmount(input.amount),
        requestPayload: input.requestPayload ?? null,
        responsePayload: input.responsePayload ?? null,
        message: input.message?.trim()?.slice(0, 500) || null,
      });
      const saved = await this.auditRepo.save(row);

      const full = await this.auditRepo.findOne({
        where: { id: saved.id },
        relations: { client: true, user: true },
      });
      if (full) {
        this.bitacoraGateway?.emitCreated(this.mapRow(full));
      }
    } catch (err) {
      this.logger.error(
        `No se pudo registrar bitácora (${input.operationType}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Lista completa por rango de fechas (sin paginación). */
  async findFiltered(filter: FilterAuditLogDto) {
    const fromRaw = filter.from?.trim();
    const toRaw = filter.to?.trim();
    if (!fromRaw || !toRaw) {
      throw new BadRequestException('from y to son requeridos');
    }

    const from = parseRangeStart(fromRaw);
    const to = parseRangeEnd(toRaw);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException(
        'El rango de fechas es inválido (from > to)',
      );
    }

    const where: FindOptionsWhere<OperationAuditLog> = {
      fhRegister: Between(from, to),
    };

    const rows = await this.auditRepo.find({
      where,
      relations: { client: true, user: true },
      order: { id: 'DESC' },
    });

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Fechas de cada check_status por ReferenceId (externalId), orden ASC.
   */
  async findCheckStatusTimesByReferenceIds(
    referenceIds: string[],
  ): Promise<Map<string, Date[]>> {
    const map = new Map<string, Date[]>();
    const ids = [
      ...new Set(
        referenceIds
          .map((id) => String(id ?? '').trim())
          .filter((id) => id.length > 0),
      ),
    ];
    if (ids.length === 0) return map;

    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const rows = await this.auditRepo.find({
        where: {
          operationType: AUDIT_OPERATION.CHECK_STATUS,
          referenceId: In(chunk),
        },
        select: {
          id: true,
          referenceId: true,
          fhRegister: true,
        },
        order: { fhRegister: 'ASC', id: 'ASC' },
      });

      for (const row of rows) {
        const key = String(row.referenceId ?? '').trim();
        if (!key) continue;
        const fh =
          row.fhRegister instanceof Date
            ? row.fhRegister
            : new Date(row.fhRegister);
        if (Number.isNaN(fh.getTime())) continue;
        const list = map.get(key) ?? [];
        list.push(fh);
        map.set(key, list);
      }
    }

    return map;
  }

  private mapRow(r: OperationAuditLog) {
    return {
      id: r.id,
      fhRegister: r.fhRegister,
      operationType: r.operationType,
      operationLabel: this.operationLabel(r.operationType),
      status: r.status,
      clientId: r.client?.id ?? null,
      cliente: clientLabel(r.client),
      userId: r.user?.id ?? null,
      referenceId: r.referenceId,
      amount: r.amount,
      requestPayload: r.requestPayload,
      responsePayload: r.responsePayload,
      message: r.message,
    };
  }

  private operationLabel(type: string): string {
    switch (type) {
      case AUDIT_OPERATION.TRANSACTION_CREATE:
        return 'Venta / transacción';
      case AUDIT_OPERATION.CHECK_STATUS:
        return 'Check status Movivendor';
      case AUDIT_OPERATION.BALANCE_ASSIGN:
        return 'Abono / asignación saldo';
      default:
        return type;
    }
  }
}
