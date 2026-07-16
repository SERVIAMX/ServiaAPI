import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { runInTransaction } from '../../database/query-runner.util';
import { calcularSaldoAcreditadoConBonificacion } from '../../common/utils/client-balance-bonus.util';
import {
  AUDIT_OPERATION,
  AUDIT_STATUS,
} from '../audit-log/audit-log.types';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { AdjustCustomerBalanceDto } from './dto/adjust-customer-balance.dto';
import { FilterBalanceHistoryDto } from './dto/filter-balance-history.dto';
import { MarkBalanceHistoryPaidDto } from './dto/mark-balance-history-paid.dto';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function parseMovivendorBalance(json: unknown): number | null {
  if (!isRecord(json)) return null;

  if (typeof json.code === 'number' && json.code !== 0) {
    return null;
  }

  const candidates: unknown[] = [
    json.balance,
    isRecord(json.data) ? json.data.balance : undefined,
    isRecord(json.data) && isRecord(json.data.data)
      ? json.data.data.balance
      : undefined,
  ];

  for (const v of candidates) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

interface MovivendorLoginData {
  token: string;
}

interface MovivendorLoginResponse {
  code: number;
  message?: string;
  data?: MovivendorLoginData;
}

@Injectable()
export class BalanceService {
  /** Rol portal administración (mismo criterio que `auth` / `transactions`). */
  private readonly administratorRoleId = 1;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepository: Repository<CustomerBalance>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(BalanceHistory)
    private readonly balanceHistoryRepository: Repository<BalanceHistory>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  private cfg(key: string): string | undefined {
    const v = this.config.get<string>(key);
    return typeof v === 'string' ? v.trim() : v;
  }

  /**
   * Super Administrador, Administrador (por nombre de rol) o portal administración (`RoleId = 1`).
   */
  private async assertBalancePrivilegedAdmin(roleId: number): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
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

  private clienteNombreConId(client: Client | null | undefined): string {
    if (!client) return '';
    const nombre =
      (client.tradeName?.trim() || client.businessName?.trim() || '').trim() ||
      'Cliente';
    return `${nombre} (${client.id})`;
  }

  private async loginMovivendor(): Promise<string> {
    const url = this.cfg('MOVIVENDOR_LOGIN');
    const user = this.cfg('MOVIVENDOR_CHANNEL');
    const password = this.cfg('MOVIVENDOR_PASS');
    const ident = this.cfg('MOVIVENDOR_USER');
    if (!url || !user || !password || !ident) {
      throw new InternalServerErrorException(
        'Configuración Movivendor incompleta (MOVIVENDOR_LOGIN, MOVIVENDOR_CHANNEL, MOVIVENDOR_PASS, MOVIVENDOR_USER)',
      );
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          user,
          password,
          ident,
          expire_seconds: 3600,
        }),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con Movivendor (login)');
    }

    let json: MovivendorLoginResponse;
    try {
      json = (await res.json()) as MovivendorLoginResponse;
    } catch {
      throw new BadGatewayException('Respuesta inválida de Movivendor (login)');
    }

    if (!res.ok) {
      throw new BadGatewayException(
        json?.message ?? `Movivendor login HTTP ${res.status}`,
      );
    }

    if (json.code !== 0 || !json.data?.token) {
      throw new BadGatewayException(json.message ?? 'Movivendor login rechazado');
    }

    return json.data.token;
  }

  async consultarSaldoMovivendor(): Promise<{ balance: number }> {
    const url = this.cfg('MOVIVENDOR_BALANCE');
    if (!url) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_BALANCE en configuración',
      );
    }

    const token = await this.loginMovivendor();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con Movivendor (balance)');
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadGatewayException('Respuesta inválida de Movivendor (balance)');
    }

    if (!res.ok) {
      const msg =
        typeof json === 'object' &&
        json !== null &&
        'message' in json &&
        typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : `Movivendor balance HTTP ${res.status}`;
      throw new BadGatewayException(msg);
    }

    if (
      isRecord(json) &&
      typeof json.code === 'number' &&
      json.code !== 0
    ) {
      const msg =
        typeof json.message === 'string' && json.message.trim()
          ? json.message
          : `Movivendor balance code ${json.code}`;
      throw new BadGatewayException(msg);
    }

    const balance = parseMovivendorBalance(json);
    if (balance === null) {
      throw new BadGatewayException('Respuesta inválida de Movivendor (balance)');
    }

    return { balance };
  }

  async ajustarSaldoCliente(
    dto: AdjustCustomerBalanceDto,
    actor?: { userId: number; clientId: number },
  ) {
    const customerId = dto.customerId;
    const amount = dto.amount;
    const requiresCredit = dto.requiresCredit;

    try {
    const client = await this.clientRepository.findOne({
      where: { id: customerId },
    });
    if (!client || client.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (requiresCredit) {
      const pendientePago = await this.balanceHistoryRepository.count({
        where: {
          customer: { id: customerId },
          isPaid: 0,
        },
      });
      if (pendientePago > 0) {
        throw new BadRequestException(
          'El cliente tiene un abono pendiente de pago (BalanceHistory isPaid = 0). Solo puede recibir saldo pagado hasta liquidarlo.',
        );
      }
    }

    return runInTransaction(this.dataSource, async (manager) => {
      let cb = await manager.findOne(CustomerBalance, {
        where: { customer: { id: customerId } },
        relations: { customer: true },
      });

      if (!cb) {
        cb = this.customerBalanceRepository.create({
          customer: client,
          creditBalance: '0.00',
          balance: '0.00',
        });
      }

      const currentCredit = Number(cb.creditBalance ?? 0) || 0;
      const currentBalance = Number(cb.balance ?? 0) || 0;

      const acreditado = calcularSaldoAcreditadoConBonificacion(
        amount,
        client.discountPercentage,
      );

      if (requiresCredit) {
        const creditLine = client.creditLine ? Number(client.creditLine) : null;
        if (creditLine === null || Number.isNaN(creditLine)) {
          throw new BadRequestException('Cliente sin CreditLine configurado');
        }
        const available = creditLine - currentCredit;
        if (amount > available) {
          throw new BadRequestException(
            'El monto solicitado excede la línea de crédito disponible',
          );
        }
        cb.creditBalance = (currentCredit + acreditado).toFixed(2);
      } else {
        cb.balance = (currentBalance + acreditado).toFixed(2);
      }

      await manager.save(cb);

      const hist = this.balanceHistoryRepository.create({
        customer: client,
        amount: amount.toFixed(2),
        acreditado: acreditado.toFixed(2),
        transactionType: requiresCredit ? 2 : 1,
        isPaid: requiresCredit ? 0 : 1,
      });
      const savedHist = await manager.save(hist);

      await this.auditLogService.record({
        operationType: AUDIT_OPERATION.BALANCE_ASSIGN,
        status: AUDIT_STATUS.SUCCESS,
        clientId: customerId,
        userId: actor?.userId ?? null,
        referenceId: String(savedHist.id),
        amount: dto.amount,
        requestPayload: dto,
        responsePayload: {
          balance: cb.balance,
          creditBalance: cb.creditBalance,
          acreditado: acreditado.toFixed(2),
          requiresCredit,
          balanceHistoryId: savedHist.id,
        },
      });

      return {
        customerId,
        amount: amount.toFixed(2),
        acreditado: acreditado.toFixed(2),
        montoSpei: amount.toFixed(2),
        balanceHistoryId: savedHist.id,
        balance: cb.balance,
        creditBalance: cb.creditBalance,
        creditLine: client.creditLine,
        transactionType: requiresCredit ? 2 : 1,
        isPaid: requiresCredit ? 0 : 1,
      };
    });
    } catch (e) {
      await this.auditLogService.record({
        operationType: AUDIT_OPERATION.BALANCE_ASSIGN,
        status: AUDIT_STATUS.ERROR,
        clientId: customerId,
        userId: actor?.userId ?? null,
        amount: dto.amount,
        requestPayload: dto,
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  /** El cliente autenticado solicita crédito sobre su propia cuenta (`clientId` del JWT). */
  async solicitarCreditoPropio(
    authUser: { userId: number; clientId: number },
    amount: number,
  ): Promise<{ success: true; message: string }> {
    if (!authUser.clientId) {
      throw new BadRequestException('Usuario sin cliente asignado');
    }
    await this.ajustarSaldoCliente(
      {
        customerId: authUser.clientId,
        amount,
        requiresCredit: true,
      },
      authUser,
    );
    return {
      success: true,
      message: 'Saldo asignado correctamente',
    };
  }

  async obtenerCustomerBalance(clientId: number): Promise<{
    lineCredit: number | null;
    balance: number;
    creditBalance: number;
  }> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
    });
    if (!client || client.deletedAt) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const cb = await this.customerBalanceRepository.findOne({
      where: { customer: { id: clientId } },
      relations: { customer: true },
    });

    const balance = cb?.balance ? Number(cb.balance) : 0;
    const creditBalance = cb?.creditBalance ? Number(cb.creditBalance) : 0;

    return {
      lineCredit: client.creditLine ? Number(client.creditLine) : null,
      balance: Number.isNaN(balance) ? 0 : balance,
      creditBalance: Number.isNaN(creditBalance) ? 0 : creditBalance,
    };
  }

  async obtenerBalanceHistory(clientId: number, filter: FilterBalanceHistoryDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.balanceHistoryRepository
      .createQueryBuilder('bh')
      .where('bh.CustomerId = :cid', { cid: clientId });

    if (filter.fechaInicio) {
      qb.andWhere('bh.fhRegistro >= :fi', { fi: filter.fechaInicio });
    }
    if (filter.fechaFin) {
      qb.andWhere('bh.fhRegistro <= :ff', { ff: filter.fechaFin });
    }

    const [data, total] = await qb
      .orderBy('bh.fhRegistro', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data.map((h) => ({
        id: h.id,
        amount: h.amount,
        acreditado: h.acreditado,
        fhRegistro: h.fhRegistro,
        transactionType: h.transactionType === 2 ? 'Credito' : 'Pagado',
        isPaid: h.isPaid === 1 ? 'Pagado' : 'Pendiente',
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Movimientos con saldo pendiente de pago (`isPaid = 0`), todos los clientes.
   * Acceso: "Super Administrador", "Administrador" (nombre de rol) o `RoleId = 1`.
   */
  async obtenerHistorialPendientePagoGlobal(
    roleId: number,
    filter: FilterBalanceHistoryDto,
  ) {
    await this.assertBalancePrivilegedAdmin(roleId);

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.balanceHistoryRepository
      .createQueryBuilder('bh')
      .innerJoinAndSelect('bh.customer', 'c')
      .where('bh.isPaid = :paid', { paid: 0 })
      .andWhere('c.deletedAt IS NULL');

    if (filter.fechaInicio) {
      qb.andWhere('bh.fhRegistro >= :fi', { fi: filter.fechaInicio });
    }
    if (filter.fechaFin) {
      qb.andWhere('bh.fhRegistro <= :ff', { ff: filter.fechaFin });
    }

    const [data, total] = await qb
      .orderBy('bh.fhRegistro', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data.map((h) => ({
        id: h.id,
        customerId: h.customer?.id ?? null,
        cliente: this.clienteNombreConId(h.customer ?? undefined),
        amount: h.amount,
        acreditado: h.acreditado,
        fhRegistro: h.fhRegistro,
        transactionType: h.transactionType === 2 ? 'Credito' : 'Pagado',
        isPaid: 'Pendiente',
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Marca un `BalanceHistory` pendiente (`isPaid = 0`) como pagado (`isPaid = 1`).
   */
  async marcarBalanceHistoryComoPagado(
    roleId: number,
    dto: MarkBalanceHistoryPaidDto,
  ) {
    await this.assertBalancePrivilegedAdmin(roleId);

    const row = await this.balanceHistoryRepository.findOne({
      where: { id: dto.balanceHistoryId },
      relations: { customer: true },
    });
    if (!row) {
      throw new NotFoundException('Movimiento de balance no encontrado');
    }

    if (row.isPaid === 1) {
      throw new BadRequestException('El movimiento ya está marcado como pagado');
    }
    if (row.isPaid !== 0) {
      throw new BadRequestException(
        'El movimiento no está en estado pendiente de pago (isPaid = 0)',
      );
    }

    row.isPaid = 1;
    await this.balanceHistoryRepository.save(row);

    return {
      id: row.id,
      customerId: row.customer?.id ?? null,
      cliente: this.clienteNombreConId(row.customer ?? undefined),
      amount: row.amount,
      fhRegistro: row.fhRegistro,
      transactionType: row.transactionType === 2 ? 'Credito' : 'Pagado',
      isPaid: 'Pagado',
    };
  }
}

