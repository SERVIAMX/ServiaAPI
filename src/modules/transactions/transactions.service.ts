import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, Repository } from 'typeorm';
import { buildExcelXmlSpreadsheet } from '../../common/utils/spreadsheet.util';
import { MOVIVENDOR_VENTA_DELAY_SECONDS } from '../../common/constants/movivendor-timing.constants';
import { runInTransaction } from '../../database/query-runner.util';
import { MovivendorTimeoutException } from '../../common/exceptions/movivendor-timeout.exception';
import {
  AUDIT_OPERATION,
  AUDIT_STATUS,
} from '../audit-log/audit-log.types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { ProductosService } from '../productos/productos.service';
import { User } from '../users/entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { TransactionHistory } from './entities/transaction-history.entity';
import { recargaEstadoFromCode, Transaction } from './entities/transaction.entity';
import { TransactionGateService } from './transaction-gate.service';

function recargaEstadoFromMovivendor(json: unknown): 'exitosa' | 'fallida' | 'pendiente' {
  if (typeof json !== 'object' || json === null) return 'pendiente';
  const code = (json as Record<string, unknown>).code;
  return recargaEstadoFromCode(
    code === undefined || code === null ? '' : String(code),
  );
}

function isMovivendorProviderError(json: unknown): boolean {
  if (typeof json !== 'object' || json === null) return false;
  const code = (json as Record<string, unknown>).code;
  if (typeof code === 'number') return code !== 0;
  if (typeof code === 'string') {
    const c = code.trim();
    return c !== '' && c !== '0' && c !== '00';
  }
  return false;
}

function movivendorPayloadFromError(error: unknown): {
  code?: string;
  responseProvider: unknown;
} {
  if (error instanceof ConflictException) {
    const resp = error.getResponse();
    if (typeof resp === 'object' && resp !== null && 'data' in resp) {
      const data = (resp as { data: unknown }).data;
      if (typeof data === 'object' && data !== null) {
        const rec = data as Record<string, unknown>;
        const code =
          typeof rec.code === 'number' || typeof rec.code === 'string'
            ? String(rec.code)
            : undefined;
        return { code, responseProvider: data };
      }
    }
  }

  return {
    responseProvider: {
      error: true,
      message:
        error instanceof Error ? error.message : 'Error en proveedor',
    },
  };
}

/** Asegura 0 | 1 | null en respuestas (evita boolean del driver). */
function normalizeIsCredit(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v);
  if (n === 0 || n === 1) return n;
  return null;
}

/** 0 = Pagado (Balance), 1 = Crédito (CreditBalance). */
function tipoCobroFromIsCredit(ic: number | null): 'Pagado' | 'Crédito' | null {
  if (ic === null) return null;
  if (ic === 0) return 'Pagado';
  if (ic === 1) return 'Crédito';
  return null;
}

function formatYYMMDDHHmmss(d: Date): string {
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${MM}${dd}${HH}${mm}${ss}`;
}

function padInt(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s.slice(-width) : s.padStart(width, '0');
}

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

function queryAffectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (header && typeof header === 'object' && 'affectedRows' in header) {
    return Number((header as { affectedRows: number }).affectedRows) || 0;
  }
  return 0;
}

function amountForMovivendor(amount: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) {
    throw new BadRequestException('Amount inválido en la transacción');
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

type TxRecord = Pick<
  Transaction,
  'externalId' | 'sku' | 'destination' | 'amount' | 'idTransaction'
> & { source: 'current' | 'history' };

/** Persiste code/responseProvider tras check-status (no aplica a 88 ni 89). */
function shouldPersistCheckStatusCode(code: unknown): boolean {
  if (code === undefined || code === null) return false;
  const c = String(code).trim();
  if (c === '88' || c === '89') return false;
  return true;
}

function movivendorCodeToString(code: unknown): string {
  if (code === undefined || code === null) return '';
  return String(code).trim();
}

function formatExcelDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  // Formato fijo YYYY-MM-DD HH:mm:ss en America/Mexico_City (más estable en Excel).
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(TransactionHistory)
    private readonly txHistoryRepo: Repository<TransactionHistory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepo: Repository<CustomerBalance>,
    private readonly productosService: ProductosService,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly transactionGate: TransactionGateService,
  ) {}

  private mapTransactionListItem(t: Transaction) {
    const isCredit = normalizeIsCredit(t.isCredit);
    const tipoCobro = tipoCobroFromIsCredit(isCredit);
    return {
      idTransaction: t.idTransaction,
      tipoCobro,
      isCredit,
      fhRegister: t.fhRegister,
      externalId: t.externalId,
      amount: t.amount,
      code: t.code,
      recargaEstado: recargaEstadoFromCode(t.code),
      sku: t.sku,
      logo: t.logo,
      fhUpdate: t.fhUpdate,
      ventaDurationSeconds: t.ventaDurationSeconds,
      fhCheckStatus: t.fhCheckStatus,
      netAmount: t.netAmount,
      destination: t.destination,
      brand: t.brand,
      esTAE: normalizeIsCredit(t.esTAE),
    };
  }

  private async buildTransactionsExcel(
    rows: Array<{
      externalId: string;
      fhRegister: Date;
      fhCheckStatus?: Date | null;
    }>,
    fromLabel: string,
    toLabel: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const checksByExternalId =
      await this.auditLogService.findCheckStatusTimesByReferenceIds(
        rows.map((t) => t.externalId),
      );

    // Si no hay bitácora pero sí FHCheckStatus en la tx, úsalo como SaleCheck 1.
    for (const t of rows) {
      const key = String(t.externalId ?? '').trim();
      if (!key) continue;
      const existing = checksByExternalId.get(key);
      if (existing && existing.length > 0) continue;
      if (t.fhCheckStatus) {
        const fh =
          t.fhCheckStatus instanceof Date
            ? t.fhCheckStatus
            : new Date(t.fhCheckStatus);
        if (!Number.isNaN(fh.getTime())) {
          checksByExternalId.set(key, [fh]);
        }
      }
    }

    let maxChecks = 0;
    for (const times of checksByExternalId.values()) {
      if (times.length > maxChecks) maxChecks = times.length;
    }

    const headers = [
      'ExternalId',
      'Hora inicio',
      ...Array.from({ length: maxChecks }, (_, i) => `SaleCheck ${i + 1}`),
    ];

    const dataRows = rows.map((t) => {
      const key = String(t.externalId ?? '').trim();
      const checks = checksByExternalId.get(key) ?? [];
      const checkCells = Array.from({ length: maxChecks }, (_, i) =>
        formatExcelDateTime(checks[i]),
      );
      return [
        // Prefijo tabular para forzar texto en Excel (evita notación científica / perder ceros).
        `\t${key}`,
        formatExcelDateTime(t.fhRegister),
        ...checkCells,
      ];
    });

    const safeFrom = fromLabel.trim().slice(0, 10);
    const safeTo = toLabel.trim().slice(0, 10);
    this.logger.log(
      `[excel] filas=${dataRows.length} maxSaleChecks=${maxChecks} rango=${safeFrom}..${safeTo}`,
    );
    return {
      buffer: buildExcelXmlSpreadsheet('SaleChecks', headers, dataRows),
      filename: `transacciones_salecheck_${safeFrom}_${safeTo}.xls`,
    };
  }

  /** Une Transactions + TransactionsHistory por ExternalId (prioriza actual). */
  private async loadExcelTransactionRows(opts: {
    from: Date;
    to: Date;
    userId?: number;
  }): Promise<
    Array<{ externalId: string; fhRegister: Date; fhCheckStatus: Date | null }>
  > {
    const whereCurrent =
      opts.userId != null
        ? {
            user: { id: opts.userId },
            fhRegister: Between(opts.from, opts.to),
          }
        : { fhRegister: Between(opts.from, opts.to) };

    const whereHistory =
      opts.userId != null
        ? {
            user: { id: opts.userId },
            fhRegister: Between(opts.from, opts.to),
          }
        : { fhRegister: Between(opts.from, opts.to) };

    const [current, history] = await Promise.all([
      this.txRepo.find({
        where: whereCurrent,
        select: {
          externalId: true,
          fhRegister: true,
          fhCheckStatus: true,
          idTransaction: true,
        },
        order: { idTransaction: 'DESC' },
      }),
      this.txHistoryRepo.find({
        where: whereHistory,
        select: {
          externalId: true,
          fhRegister: true,
          fhCheckStatus: true,
          idTransaction: true,
        },
        order: { idTransaction: 'DESC' },
      }),
    ]);

    const byExternalId = new Map<
      string,
      { externalId: string; fhRegister: Date; fhCheckStatus: Date | null }
    >();

    // Historial primero; actual pisa si hay duplicado.
    for (const t of history) {
      const key = String(t.externalId ?? '').trim();
      if (!key) continue;
      byExternalId.set(key, {
        externalId: key,
        fhRegister: t.fhRegister,
        fhCheckStatus: t.fhCheckStatus ?? null,
      });
    }
    for (const t of current) {
      const key = String(t.externalId ?? '').trim();
      if (!key) continue;
      byExternalId.set(key, {
        externalId: key,
        fhRegister: t.fhRegister,
        fhCheckStatus: t.fhCheckStatus ?? null,
      });
    }

    return [...byExternalId.values()].sort((a, b) => {
      const ta = new Date(a.fhRegister).getTime();
      const tb = new Date(b.fhRegister).getTime();
      return tb - ta;
    });
  }

  private parseFilterRange(filter: FilterTransactionsDto): {
    from: Date;
    to: Date;
  } {
    const from = parseRangeStart(filter.from);
    const to = parseRangeEnd(filter.to);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('El rango de fechas es inválido (from > to)');
    }
    return { from, to };
  }

  /**
   * Descuenta saldo sin `SELECT FOR UPDATE` (evita bloqueos largos en CustomerBalance).
   * @returns 0 = Balance, 1 = CreditBalance
   */
  private async descontarSaldoCliente(
    manager: EntityManager,
    clientId: number,
    charged: number,
  ): Promise<0 | 1> {
    const amt = charged.toFixed(2);

    const exists = await manager.query(
      'SELECT Id FROM CustomerBalance WHERE CustomerId = ? LIMIT 1',
      [clientId],
    );
    if (!Array.isArray(exists) || exists.length === 0) {
      throw new NotFoundException('Balance del cliente no encontrado');
    }

    const fromBalance = queryAffectedRows(
      await manager.query(
        'UPDATE CustomerBalance SET Balance = Balance - ? WHERE CustomerId = ? AND Balance >= ?',
        [amt, clientId, amt],
      ),
    );
    if (fromBalance > 0) return 0;

    const fromCredit = queryAffectedRows(
      await manager.query(
        'UPDATE CustomerBalance SET CreditBalance = CreditBalance - ? WHERE CustomerId = ? AND CreditBalance >= ?',
        [amt, clientId, amt],
      ),
    );
    if (fromCredit > 0) return 1;

    throw new BadRequestException('No cuentas con saldo suficiente');
  }

  private async reintegrarSaldoCliente(
    manager: EntityManager,
    clientId: number,
    charged: number,
    isCredit: number,
  ): Promise<void> {
    const amt = charged.toFixed(2);
    if (isCredit === 0) {
      await manager.query(
        'UPDATE CustomerBalance SET Balance = Balance + ? WHERE CustomerId = ?',
        [amt, clientId],
      );
    } else {
      await manager.query(
        'UPDATE CustomerBalance SET CreditBalance = CreditBalance + ? WHERE CustomerId = ?',
        [amt, clientId],
      );
    }
  }

  /** Reintegra saldo tras rechazo del proveedor (code/responseProvider ya guardados). */
  private async revertirSaldoTrasRechazoProveedor(
    clientId: number,
    isCreditUsed: number,
    charged: number,
    idTransaction: number,
  ): Promise<void> {
    try {
      await runInTransaction(this.dataSource, async (manager) => {
        await this.reintegrarSaldoCliente(
          manager,
          clientId,
          charged,
          isCreditUsed,
        );
      });
      this.logger.log(
        `[createTransaction] Saldo revertido tras rechazo proveedor (tx #${idTransaction})`,
      );
    } catch (revertErr) {
      this.logger.error(
        `[createTransaction] No se pudo revertir saldo (tx #${idTransaction}): ${revertErr instanceof Error ? revertErr.message : revertErr}`,
      );
    }
  }

  /** Si Movivendor falla después del commit, revierte saldo y marca error en la fila. */
  private async revertirTrasFalloProveedor(
    clientId: number,
    idTransaction: number,
    isCreditUsed: number,
    charged: number,
    error: unknown,
  ): Promise<void> {
    try {
      await runInTransaction(this.dataSource, async (manager) => {
        await this.reintegrarSaldoCliente(
          manager,
          clientId,
          charged,
          isCreditUsed,
        );

        const mv = movivendorPayloadFromError(error);
        await manager.update(
          Transaction,
          { idTransaction },
          {
            ...(mv.code ? { code: mv.code } : {}),
            responseProvider: mv.responseProvider as any,
          },
        );
      });
      this.logger.log(
        `[createTransaction] Saldo revertido tras fallo proveedor (tx #${idTransaction})`,
      );
    } catch (revertErr) {
      this.logger.error(
        `[createTransaction] No se pudo revertir saldo (tx #${idTransaction}): ${revertErr instanceof Error ? revertErr.message : revertErr}`,
      );
    }
  }

  async findByUserAndDateRange(userId: number, filter: FilterTransactionsDto) {
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const { from, to } = this.parseFilterRange(filter);

    const [rows, total] = await this.txRepo.findAndCount({
      where: {
        user: { id: userId },
        fhRegister: Between(from, to),
      },
      order: { idTransaction: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = rows.map((t) => this.mapTransactionListItem(t));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findByDateRange(filter: FilterTransactionsDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const { from, to } = this.parseFilterRange(filter);

    const [rows, total] = await this.txRepo.findAndCount({
      where: { fhRegister: Between(from, to) },
      order: { idTransaction: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = rows.map((t) => this.mapTransactionListItem(t));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findByUserAndExternalId(userId: number, externalId: string) {
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');

    const ext = String(externalId ?? '').trim();
    if (!/^\d+$/.test(ext) || ext.length > 20) {
      throw new BadRequestException('ExternalId inválido (debe ser numérico y <= 20)');
    }

    const t = await this.txRepo.findOne({
      where: { externalId: ext, user: { id: userId } },
    });
    if (!t) throw new NotFoundException('Transacción no encontrada');

    const isCredit = normalizeIsCredit(t.isCredit);
    const tipoCobro = tipoCobroFromIsCredit(isCredit);
    return {
      idTransaction: t.idTransaction,
      tipoCobro,
      isCredit,
      fhRegister: t.fhRegister,
      externalId: t.externalId,
      amount: t.amount,
      code: t.code,
      recargaEstado: recargaEstadoFromCode(t.code),
      sku: t.sku,
      logo: t.logo,
      fhUpdate: t.fhUpdate,
      ventaDurationSeconds: t.ventaDurationSeconds,
      fhCheckStatus: t.fhCheckStatus,
      destination: t.destination,
      brand: t.brand,
      esTAE: normalizeIsCredit(t.esTAE),
    };
  }

  async findByExternalId(externalId: string) {
    const ext = String(externalId ?? '').trim();
    if (!/^\d+$/.test(ext) || ext.length > 20) {
      throw new BadRequestException('ExternalId inválido (debe ser numérico y <= 20)');
    }

    const t = await this.txRepo.findOne({ where: { externalId: ext } });
    if (!t) throw new NotFoundException('Transacción no encontrada');

    const isCredit = normalizeIsCredit(t.isCredit);
    const tipoCobro = tipoCobroFromIsCredit(isCredit);
    return {
      idTransaction: t.idTransaction,
      tipoCobro,
      isCredit,
      fhRegister: t.fhRegister,
      externalId: t.externalId,
      amount: t.amount,
      code: t.code,
      recargaEstado: recargaEstadoFromCode(t.code),
      sku: t.sku,
      logo: t.logo,
      fhUpdate: t.fhUpdate,
      ventaDurationSeconds: t.ventaDurationSeconds,
      fhCheckStatus: t.fhCheckStatus,
      destination: t.destination,
      brand: t.brand,
      esTAE: normalizeIsCredit(t.esTAE),
    };
  }

  /**
   * Consulta estatus en Movivendor (`check/tx`) usando datos guardados en BD.
   */
  async checkStatus(
    externalId: string,
    authUser?: { userId: number; clientId: number },
  ) {
    const ext = String(externalId ?? '').trim();
    try {
      if (!/^\d+$/.test(ext) || ext.length > 20) {
        throw new BadRequestException('ExternalId inválido (debe ser numérico y <= 20)');
      }

      const tx = await this.findTxRecordByExternalId(ext);
      const destination = tx.destination?.trim();
      if (!destination) {
        throw new BadRequestException(
          'La transacción no tiene destination para consultar estatus',
        );
      }

      this.logger.log(
        `[checkStatus] externalId=${ext} idTransaction=${tx.idTransaction} sku=${tx.sku}`,
      );

      const movivendor = await this.productosService.estatusVenta({
        id: tx.externalId,
        product: tx.sku,
        subprod: '0',
        destination,
        amount: amountForMovivendor(tx.amount),
      });

      await this.persistCheckStatusResponse(tx, movivendor);

      const result = {
        externalId: tx.externalId,
        idTransaction: tx.idTransaction,
        movivendor,
      };

      const mvCode =
        typeof movivendor === 'object' &&
        movivendor !== null &&
        'code' in movivendor
          ? (movivendor as { code: unknown }).code
          : null;

      await this.auditLogService.record({
        operationType: AUDIT_OPERATION.CHECK_STATUS,
        status:
          mvCode === 0 || mvCode === '0'
            ? AUDIT_STATUS.SUCCESS
            : AUDIT_STATUS.ERROR,
        clientId: authUser?.clientId ?? null,
        userId: authUser?.userId ?? null,
        referenceId: tx.externalId,
        amount: tx.amount,
        requestPayload: { externalId: ext },
        responsePayload: result,
      });

      return result;
    } catch (e) {
      await this.auditLogService.record({
        operationType: AUDIT_OPERATION.CHECK_STATUS,
        status: AUDIT_STATUS.ERROR,
        clientId: authUser?.clientId ?? null,
        userId: authUser?.userId ?? null,
        referenceId: ext || null,
        requestPayload: { externalId: ext },
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private async persistCheckStatusResponse(
    tx: TxRecord,
    movivendor: unknown,
  ): Promise<void> {
    const fhCheckStatus = new Date();
    const repo =
      tx.source === 'current' ? this.txRepo : this.txHistoryRepo;

    if (typeof movivendor !== 'object' || movivendor === null) {
      await repo.update({ idTransaction: tx.idTransaction }, { fhCheckStatus });
      return;
    }

    const rec = movivendor as Record<string, unknown>;
    if (!shouldPersistCheckStatusCode(rec.code)) {
      this.logger.log(
        `[checkStatus] Sin actualizar code: code=${movivendorCodeToString(rec.code)} (88/89); FHCheckStatus=${fhCheckStatus.toISOString()}`,
      );
      await repo.update({ idTransaction: tx.idTransaction }, { fhCheckStatus });
      return;
    }

    const codeStr = movivendorCodeToString(rec.code);
    await repo.update(
      { idTransaction: tx.idTransaction },
      {
        fhCheckStatus,
        code: codeStr,
        responseProvider: movivendor as object,
      },
    );

    this.logger.log(
      `[checkStatus] Actualizado ${tx.source === 'current' ? 'Transactions' : 'TransactionsHistory'} #${tx.idTransaction} code=${codeStr} FHCheckStatus=${fhCheckStatus.toISOString()}`,
    );
  }

  private async findTxRecordByExternalId(ext: string): Promise<TxRecord> {
    const current = await this.txRepo.findOne({
      where: { externalId: ext },
      select: {
        idTransaction: true,
        externalId: true,
        sku: true,
        destination: true,
        amount: true,
      },
    });
    if (current) return { ...current, source: 'current' };

    const history = await this.txHistoryRepo.findOne({
      where: { externalId: ext },
      select: {
        idTransaction: true,
        externalId: true,
        sku: true,
        destination: true,
        amount: true,
      },
    });
    if (history) return { ...history, source: 'history' };

    throw new NotFoundException('Transacción no encontrada');
  }

  /** ExternalId: IdCliente(4) + IdUser(4) + yyMMddHHmmss(12). */
  private buildExternalId(clientId: number, userId: number, at = new Date()): string {
    return `${padInt(clientId, 4)}${padInt(userId, 4)}${formatYYMMDDHHmmss(at)}`;
  }

  private assertValidExternalId(id: string): void {
    if (!/^\d+$/.test(id) || id.length === 0 || id.length > 20) {
      throw new BadRequestException('ExternalId inválido (debe ser numérico y <= 20)');
    }
  }

  private assertExternalIdOwnedByUser(
    id: string,
    authUser: { userId: number; clientId: number },
  ): void {
    const prefix = `${padInt(authUser.clientId, 4)}${padInt(authUser.userId, 4)}`;
    if (!id.startsWith(prefix)) {
      throw new BadRequestException(
        'ExternalId no pertenece al usuario autenticado',
      );
    }
  }

  private async assertExternalIdAvailable(id: string): Promise<void> {
    const inCurrent = await this.txRepo.exist({ where: { externalId: id } });
    if (inCurrent) {
      throw new ConflictException(`ExternalId ya existe: ${id}`);
    }
    const inHistory = await this.txHistoryRepo.exist({
      where: { externalId: id },
    });
    if (inHistory) {
      throw new ConflictException(`ExternalId ya existe en historial: ${id}`);
    }
  }

  async generateExternalIdForUser(authUser: {
    userId: number;
    clientId: number;
  }): Promise<{ externalId: string }> {
    // Si choca el mismo segundo, reintenta hasta 5 veces sumando 1s.
    for (let i = 0; i < 5; i++) {
      const at = new Date(Date.now() + i * 1000);
      const externalId = this.buildExternalId(
        authUser.clientId,
        authUser.userId,
        at,
      );
      this.assertValidExternalId(externalId);
      const inCurrent = await this.txRepo.exist({
        where: { externalId },
      });
      if (inCurrent) continue;
      const inHistory = await this.txHistoryRepo.exist({
        where: { externalId },
      });
      if (inHistory) continue;
      return { externalId };
    }
    throw new ConflictException(
      'No se pudo generar ExternalId único; reintenta',
    );
  }

  async createTransaction(authUser: { userId: number; clientId: number }, dto: CreateTransactionDto) {
    await this.transactionGate.assertNotPaused();

    let savedIdTransaction: number | undefined;
    let externalId: string | undefined;

    try {
    const user = await this.userRepo.findOne({
      where: { id: authUser.userId },
      relations: { client: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const client =
      user.client ??
      (await this.clientRepo.findOne({
        where: { id: authUser.clientId },
      }));
    if (!client) throw new NotFoundException('Cliente no encontrado');

    let id: string;
    if (dto.externalId?.trim()) {
      id = dto.externalId.trim();
      this.assertValidExternalId(id);
      this.assertExternalIdOwnedByUser(id, authUser);
      await this.assertExternalIdAvailable(id);
    } else {
      id = (await this.generateExternalIdForUser(authUser)).externalId;
    }
    externalId = id;

    const amountNum = Number(dto.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Amount inválido');
    }

    const tipo = dto.tipo?.trim().toLowerCase() ?? '';
    const isTiempoAire = tipo === 'tiempo_aire';
    const esTAE = isTiempoAire ? 1 : 0;

    // charged = monto que se descuenta del saldo del cliente
    let charged = amountNum;
    let netAmount = amountNum;

    if (isTiempoAire) {
      // Se cobra el monto completo; netAmount refleja el valor con DiscountPercentage (referencia/reporte).
      const discountPct = Number(client.discountPercentage ?? '0');
      const pct = Number.isFinite(discountPct) ? discountPct : 0;
      netAmount = amountNum * (1 - pct / 100);
      if (netAmount < 0) netAmount = 0;
      charged = amountNum;
    } else {
      // Servicios/CFE: CommissionPercentage = monto fijo a sumar (ej. 10 + amount 30 => 40).
      const comm = Number(client.commissionPercentage ?? '0');
      const add = Number.isFinite(comm) ? comm : 0;
      charged = amountNum + add;
      netAmount = charged;
    }

    charged = Number(charged.toFixed(2));
    netAmount = Number(netAmount.toFixed(2));

    this.logger.log(
      `[createTransaction] Inicio userId=${authUser.userId} clientId=${authUser.clientId} externalId=${id} amount=${amountNum.toFixed(2)} charged=${charged} netAmount=${netAmount}`,
    );

    let isCredit: number;

    const fase1 = await runInTransaction(this.dataSource, async (manager) => {
      const creditFlag = await this.descontarSaldoCliente(
        manager,
        authUser.clientId,
        charged,
      );

      const tx = manager.create(Transaction, {
        externalId: id,
        user: { id: user.id } as User,
        amount: amountNum.toFixed(2),
        netAmount: netAmount.toFixed(2),
        destination: dto.destination.trim(),
        brand: dto.brand?.trim() ? dto.brand.trim() : null,
        sku: dto.product,
        logo: dto.logo?.trim() ? dto.logo.trim() : null,
        code: '',
        isCredit: creditFlag,
        esTAE,
        responseProvider: null,
        ventaDurationSeconds: MOVIVENDOR_VENTA_DELAY_SECONDS.toFixed(2),
      });
      const saved = await manager.save(tx);

      this.logger.log(
        `[createTransaction] INSERT Transactions #${saved.idTransaction} externalId=${id}`,
      );

      return { idTransaction: saved.idTransaction, isCredit: creditFlag };
    });

    savedIdTransaction = fase1.idTransaction;
    isCredit = fase1.isCredit;

    // Fase 2: Movivendor sin conexión DB abierta.
    try {
      const ventaRes = await this.productosService.ejecutarVenta({
        id,
        product: dto.product,
        subprod: dto.subprod,
        destination: dto.destination,
        amount: dto.amount,
        tipo: dto.tipo,
        idTransaction: savedIdTransaction,
      });

      const isCreditNorm = normalizeIsCredit(isCredit);
      const base = {
        idTransaction: savedIdTransaction,
        externalId: id,
        isCredit: isCreditNorm,
        esTAE,
        tipoCobro: tipoCobroFromIsCredit(isCreditNorm),
        chargedAmount: charged.toFixed(2),
        netAmount: netAmount.toFixed(2),
        recargaEstado: recargaEstadoFromMovivendor(ventaRes),
        movivendor: ventaRes,
      };

      if (isMovivendorProviderError(ventaRes)) {
        await this.revertirSaldoTrasRechazoProveedor(
          authUser.clientId,
          isCredit,
          charged,
          savedIdTransaction,
        );
      }

      await this.auditLogService.record({
        operationType: AUDIT_OPERATION.TRANSACTION_CREATE,
        status: isMovivendorProviderError(ventaRes)
          ? AUDIT_STATUS.ERROR
          : AUDIT_STATUS.SUCCESS,
        clientId: authUser.clientId,
        userId: authUser.userId,
        referenceId: String(savedIdTransaction),
        amount: dto.amount,
        requestPayload: dto,
        responsePayload: base,
        message:
          base.recargaEstado === 'fallida' ? 'Recarga fallida en proveedor' : null,
      });

      return base;
    } catch (e) {
      if (e instanceof MovivendorTimeoutException) {
        this.logger.warn(
          `[createTransaction] Timeout proveedor tx #${savedIdTransaction} externalId=${id}: ${e.message}`,
        );
        const pending = await this.respuestaTransaccionPendienteProveedor({
          idTransaction: savedIdTransaction,
          externalId: id,
          isCredit,
          esTAE,
          charged,
          dto,
          timeout: e,
        });

        await this.auditLogService.record({
          operationType: AUDIT_OPERATION.TRANSACTION_CREATE,
          status: AUDIT_STATUS.PENDING,
          clientId: authUser.clientId,
          userId: authUser.userId,
          referenceId: String(savedIdTransaction),
          amount: dto.amount,
          requestPayload: dto,
          responsePayload: pending,
          message: e.message,
        });

        return pending;
      }
      await this.revertirTrasFalloProveedor(
        authUser.clientId,
        savedIdTransaction,
        isCredit,
        charged,
        e,
      );
      throw e;
    }
    } catch (e) {
      await this.auditLogService.record({
        operationType: AUDIT_OPERATION.TRANSACTION_CREATE,
        status: AUDIT_STATUS.ERROR,
        clientId: authUser.clientId,
        userId: authUser.userId,
        referenceId:
          savedIdTransaction != null
            ? String(savedIdTransaction)
            : externalId ?? null,
        amount: dto.amount,
        requestPayload: dto,
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private buildMovivendorPendiente(
    externalId: string,
    dto: CreateTransactionDto,
    timeout: MovivendorTimeoutException,
  ) {
    const amountNum = Number(dto.amount);
    const subprodNum = Number(dto.subprod);
    return {
      code: null,
      message: 'Timeout en proveedor (sin confirmación)',
      data: {
        id: externalId,
        channel: null,
        ident: null,
        date: null,
        amount: Number.isFinite(amountNum) ? amountNum : dto.amount,
        product: dto.product,
        subprod: Number.isFinite(subprodNum) ? subprodNum : dto.subprod,
        pin: null,
        customer_balance: null,
        confirmation: null,
        trace: null,
        extra: timeout.detail ? { detail: timeout.detail } : null,
        elapsed: null,
        clave: null,
      },
    };
  }

  private async respuestaTransaccionPendienteProveedor(params: {
    idTransaction: number;
    externalId: string;
    isCredit: number;
    esTAE: number;
    charged: number;
    dto: CreateTransactionDto;
    timeout: MovivendorTimeoutException;
  }) {
    const movivendor = this.buildMovivendorPendiente(
      params.externalId,
      params.dto,
      params.timeout,
    );

    await this.txRepo.update(
      { idTransaction: params.idTransaction },
      {
        responseProvider: movivendor as object,
        ventaDurationSeconds: MOVIVENDOR_VENTA_DELAY_SECONDS.toFixed(2),
      },
    );

    const isCreditNorm = normalizeIsCredit(params.isCredit);
    return {
      idTransaction: params.idTransaction,
      externalId: params.externalId,
      isCredit: isCreditNorm,
      esTAE: params.esTAE,
      tipoCobro: tipoCobroFromIsCredit(isCreditNorm),
      chargedAmount: params.charged.toFixed(2),
      recargaEstado: 'pendiente' as const,
      movivendor,
    };
  }

  async exportExcelByUser(
    userId: number,
    filter: FilterTransactionsDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');

    const { from, to } = this.parseFilterRange(filter);
    const rows = await this.loadExcelTransactionRows({ from, to, userId });
    return this.buildTransactionsExcel(rows, filter.from, filter.to);
  }

  async exportExcelAll(
    filter: FilterTransactionsDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { from, to } = this.parseFilterRange(filter);
    const rows = await this.loadExcelTransactionRows({ from, to });
    return this.buildTransactionsExcel(rows, filter.from, filter.to);
  }
}

