import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';
import {
  AUDIT_OPERATION,
  RecordAuditLogInput,
} from './audit-log.types';
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
      await this.auditRepo.save(row);
    } catch (err) {
      this.logger.error(
        `No se pudo registrar bitácora (${input.operationType}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async findFiltered(filter: FilterAuditLogDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const where: FindOptionsWhere<OperationAuditLog> = {};

    if (filter.clientId != null && filter.clientId > 0) {
      where.client = { id: filter.clientId };
    }

    if (filter.operationType?.trim()) {
      where.operationType = filter.operationType.trim();
    }

    if (filter.status?.trim()) {
      where.status = filter.status.trim();
    }

    if (filter.from?.trim() && filter.to?.trim()) {
      const from = parseRangeStart(filter.from);
      const to = parseRangeEnd(filter.to);
      where.fhRegister = Between(from, to);
    }

    const [rows, total] = await this.auditRepo.findAndCount({
      where,
      relations: { client: true, user: true },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((r) => ({
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
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
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
