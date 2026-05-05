import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { ProductosService } from '../productos/productos.service';
import { User } from '../users/entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { recargaEstadoFromCode, Transaction } from './entities/transaction.entity';

function recargaEstadoFromMovivendor(json: unknown): 'exitosa' | 'fallida' | 'pendiente' {
  if (typeof json !== 'object' || json === null) return 'pendiente';
  const code = (json as Record<string, unknown>).code;
  return recargaEstadoFromCode(
    code === undefined || code === null ? '' : String(code),
  );
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

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepo: Repository<CustomerBalance>,
    private readonly productosService: ProductosService,
    private readonly dataSource: DataSource,
  ) {}

  async findByUserAndDateRange(userId: number, filter: FilterTransactionsDto) {
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const from = parseRangeStart(filter.from);
    const to = parseRangeEnd(filter.to);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('El rango de fechas es inválido (from > to)');
    }

    const [rows, total] = await this.txRepo.findAndCount({
      where: {
        user: { id: userId },
        fhRegister: Between(from, to),
      },
      order: { idTransaction: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = rows.map((t) => {
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
        netAmount: t.netAmount,
        destination: t.destination,
        brand: t.brand,
      };
    });

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

  async createTransaction(authUser: { userId: number; clientId: number }, dto: CreateTransactionDto) {
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

    // ExternalId numérico <= 20: IdCliente(4) + IdUser(4) + yyMMddHHmmss(12)
    const id = `${padInt(authUser.clientId, 4)}${padInt(authUser.userId, 4)}${formatYYMMDDHHmmss(new Date())}`;
    if (!/^\d+$/.test(id) || id.length > 20) {
      throw new BadRequestException('ExternalId inválido (debe ser numérico y <= 20)');
    }

    const amountNum = Number(dto.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Amount inválido');
    }

    const tipo = dto.tipo?.trim().toLowerCase() ?? '';
    const isTiempoAire = tipo === 'tiempo_aire';

    // charged = monto que se descuenta del saldo del cliente
    let charged = amountNum;
    if (isTiempoAire) {
      const discountPct = Number(client.discountPercentage ?? '0');
      const pct = Number.isFinite(discountPct) ? discountPct : 0;
      charged = amountNum * (1 - pct / 100);
      if (charged < 0) charged = 0;
    } else {
      // Para tipos distintos de tiempo_aire, CommissionPercentage se trata como MONTO FIJO a sumar
      // (ej. commissionPercentage=10 y amount=30 => charged=40).
      const comm = Number(client.commissionPercentage ?? '0');
      const add = Number.isFinite(comm) ? comm : 0;
      charged = amountNum + add;
    }
    charged = Number(charged.toFixed(2));

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let savedIdTransaction: number | null = null;
    let isCreditUsed: number | null = null;
    try {
      // Bloquea el balance del cliente por CustomerId
      const cb = await queryRunner.manager
        .getRepository(CustomerBalance)
        .createQueryBuilder('cb')
        .where('cb.CustomerId = :cid', { cid: authUser.clientId })
        .setLock('pessimistic_write')
        .getOne();
      if (!cb) throw new NotFoundException('Balance del cliente no encontrado');

      const bal = Number(cb.balance ?? '0');
      const cred = Number(cb.creditBalance ?? '0');

      /** IsCredit: 0 = Pagado (Balance), 1 = Crédito (CreditBalance). */
      let isCredit: number;
      if (bal >= charged) {
        cb.balance = (bal - charged).toFixed(2);
        isCredit = 0;
      } else if (cred >= charged) {
        cb.creditBalance = (cred - charged).toFixed(2);
        isCredit = 1;
      } else {
        throw new BadRequestException('No cuentas con saldo suficiente');
      }

      await queryRunner.manager.save(cb);

      const tx = this.txRepo.create({
        externalId: id,
        user,
        amount: amountNum.toFixed(2),
        netAmount: charged.toFixed(2),
        destination: dto.destination.trim(),
        brand: dto.brand?.trim() ? dto.brand.trim() : null,
        sku: dto.product,
        logo: dto.logo?.trim() ? dto.logo.trim() : null,
        code: '',
        isCredit,
        responseProvider: null,
      });
      const saved = await queryRunner.manager.save(tx);
      savedIdTransaction = saved.idTransaction;
      isCreditUsed = isCredit;

      // Refuerzo: algunos drivers/TypeORM pueden leer mal TINYINT; dejamos 0/1 explícito en BD.
      await queryRunner.manager.update(
        Transaction,
        { idTransaction: saved.idTransaction },
        { isCredit },
      );

      await queryRunner.commitTransaction();

      // IMPORTANTE: la venta NO debe ejecutarse dentro de la transacción,
      // porque /productos/venta actualiza Transactions con otra conexión y puede provocar lock wait timeout.
      const ventaRes = await this.productosService.ejecutarVenta({
        id,
        product: dto.product,
        subprod: dto.subprod,
        destination: dto.destination,
        amount: dto.amount, // monto de recarga enviado a proveedor
        idTransaction: saved.idTransaction,
      });

      const isCreditNorm = normalizeIsCredit(isCredit);
      return {
        idTransaction: saved.idTransaction,
        externalId: id,
        isCredit: isCreditNorm,
        tipoCobro: tipoCobroFromIsCredit(isCreditNorm),
        chargedAmount: charged.toFixed(2),
        recargaEstado: recargaEstadoFromMovivendor(ventaRes),
        movivendor: ventaRes,
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();

      // Si ya se descontó saldo y se creó transacción, revierte el saldo y guarda el error en ResponseProvider.
      if (savedIdTransaction !== null && isCreditUsed !== null) {
        try {
          const qr2 = this.dataSource.createQueryRunner();
          await qr2.connect();
          await qr2.startTransaction();
          try {
            const cb2 = await qr2.manager
              .getRepository(CustomerBalance)
              .createQueryBuilder('cb')
              .where('cb.CustomerId = :cid', { cid: authUser.clientId })
              .setLock('pessimistic_write')
              .getOne();
            if (cb2) {
              const bal2 = Number(cb2.balance ?? '0');
              const cred2 = Number(cb2.creditBalance ?? '0');
              if (isCreditUsed === 0) {
                cb2.balance = (bal2 + charged).toFixed(2);
              } else {
                cb2.creditBalance = (cred2 + charged).toFixed(2);
              }
              await qr2.manager.save(cb2);
            }

            await qr2.manager.update(
              Transaction,
              { idTransaction: savedIdTransaction },
              {
                responseProvider: {
                  error: true,
                  message: e instanceof Error ? e.message : 'Error en proveedor',
                } as any,
              },
            );

            await qr2.commitTransaction();
          } catch {
            await qr2.rollbackTransaction();
          } finally {
            await qr2.release();
          }
        } catch {
          // best-effort: si falla el reverso no bloqueamos la excepción original
        }
      }

      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}

