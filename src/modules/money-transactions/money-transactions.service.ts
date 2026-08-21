import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { S3_VOUCHERS_FOLDER } from '../../common/constants/voucher-upload.constants';
import { runInTransaction } from '../../database/query-runner.util';
import { Role } from '../roles/entities/role.entity';
import { S3Service } from '../s3/s3.service';
import { FilterMoneyTransactionsDto } from './dto/filter-money-transactions.dto';
import { Bank } from './entities/bank.entity';
import { MoneyTransaction } from './entities/money-transaction.entity';

const BANK_ROW_ID = 1;

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

function typeLabel(type: number | null): string | null {
  if (type === 1) return 'Ingreso';
  if (type === 2) return 'Retiro';
  return null;
}

/** Parsea montos/enteros que llegan como string en multipart form-data. */
function parseFormNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return Number.NaN;
  const s = raw.trim().replace(/,/g, '');
  if (!s) return Number.NaN;
  return Number(s);
}

@Injectable()
export class MoneyTransactionsService {
  private readonly administratorRoleId = 1;

  constructor(
    @InjectRepository(MoneyTransaction)
    private readonly moneyTxRepo: Repository<MoneyTransaction>,
    @InjectRepository(Bank)
    private readonly bankRepo: Repository<Bank>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
  ) {}

  private async assertPrivilegedAdmin(roleId?: number): Promise<void> {
    if (roleId == null) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new ForbiddenException('Sin rol asignado');
    }
    const nameNorm = role.name?.trim().toLowerCase() ?? '';
    const allowedNames = new Set(['super administrador', 'administrador']);
    const isNamedAllowed = allowedNames.has(nameNorm);
    const isPortalAdmin = role.id === this.administratorRoleId;
    if (!isNamedAllowed && !isPortalAdmin) {
      throw new ForbiddenException(
        'Solo Super Administrador o Administrador pueden usar este recurso',
      );
    }
  }

  private async ensureBankRow(manager: EntityManager): Promise<Bank> {
    let bank = await manager.findOne(Bank, { where: { id: BANK_ROW_ID } });
    if (!bank) {
      bank = manager.create(Bank, { id: BANK_ROW_ID, amount: '0.00' });
      bank = await manager.save(Bank, bank);
    }
    return bank;
  }

  async create(
    roleId: number | undefined,
    amountRaw: unknown,
    typeRaw: unknown,
    voucher?: Express.Multer.File,
    comments?: string | null,
  ) {
    await this.assertPrivilegedAdmin(roleId);

    const amount = parseFormNumber(amountRaw);
    const type = parseFormNumber(typeRaw);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount inválido');
    }
    if (type !== 1 && type !== 2) {
      throw new BadRequestException('Type debe ser 1 (Ingreso) o 2 (Retiro)');
    }

    let voucherUrl: string | null = null;
    if (voucher) {
      const uploaded = await this.s3Service.uploadFile(
        voucher,
        S3_VOUCHERS_FOLDER,
      );
      voucherUrl = uploaded.url;
    }

    const commentsNorm = comments?.trim() ? comments.trim() : null;

    return runInTransaction(this.dataSource, async (manager) => {
      return this.applyBankMovement(
        manager,
        amount,
        type,
        voucherUrl,
        commentsNorm,
      );
    });
  }

  /**
   * Registra Ingreso (type=1) en MoneyTransactions y suma a Bank.Id=1.
   * Para flujos internos (approve / mark-paid); no valida rol admin.
   */
  async registerIngreso(
    amount: number,
    voucherUrl?: string | null,
    comments?: string | null,
  ): Promise<{
    id: number;
    amount: string | null;
    type: number | null;
    typeLabel: string | null;
    voucherUrl: string | null;
    comments: string | null;
    createdAt: Date | null;
    bankAmount: string | null;
  }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount inválido para ingreso de banco');
    }
    return runInTransaction(this.dataSource, async (manager) => {
      return this.applyBankMovement(
        manager,
        amount,
        1,
        voucherUrl ?? null,
        comments?.trim() ? comments.trim() : null,
      );
    });
  }

  private async applyBankMovement(
    manager: EntityManager,
    amount: number,
    type: number,
    voucherUrl: string | null,
    comments: string | null = null,
  ) {
    const bank = await this.ensureBankRow(manager);
    const current = Number(bank.amount ?? 0) || 0;
    const next = type === 1 ? current + amount : current - amount;

    bank.amount = next.toFixed(2);
    await manager.save(Bank, bank);

    const row = manager.create(MoneyTransaction, {
      amount: amount.toFixed(2),
      type,
      voucherUrl,
      comments,
    });
    const saved = await manager.save(MoneyTransaction, row);

    return {
      id: saved.id,
      amount: saved.amount,
      type: saved.type,
      typeLabel: typeLabel(saved.type),
      voucherUrl: saved.voucherUrl,
      comments: saved.comments,
      createdAt: saved.createdAt,
      bankAmount: bank.amount,
    };
  }

  async getBankAmount(roleId: number | undefined): Promise<{ amount: number }> {
    await this.assertPrivilegedAdmin(roleId);
    const bank = await this.bankRepo.findOne({ where: { id: BANK_ROW_ID } });
    return { amount: Number(bank?.amount ?? 0) || 0 };
  }

  async findByDateRange(
    roleId: number | undefined,
    filter: FilterMoneyTransactionsDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    await this.assertPrivilegedAdmin(roleId);

    const from = parseRangeStart(filter.from);
    const to = parseRangeEnd(filter.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Rango de fechas inválido (from / to)');
    }
    if (from > to) {
      throw new BadRequestException('from no puede ser mayor que to');
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const [rows, total] = await this.moneyTxRepo.findAndCount({
      where: { createdAt: Between(from, to) },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        amount: row.amount,
        type: row.type,
        typeLabel: typeLabel(row.type),
        voucherUrl: row.voucherUrl,
        comments: row.comments,
        createdAt: row.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
