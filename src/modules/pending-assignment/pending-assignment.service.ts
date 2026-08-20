import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { S3_VOUCHERS_FOLDER } from '../../common/constants/voucher-upload.constants';
import { BalanceService } from '../balance/balance.service';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { S3Service } from '../s3/s3.service';
import { FilterPendingAssignmentDto } from './dto/filter-pending-assignment.dto';
import { PendingAssignment } from './entities/pending-assignment.entity';
import { ReferenceCode } from '../references-codes/entities/reference-code.entity';

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

function clienteNombre(client: Client | null | undefined): string {
  if (!client) return 'Cliente';
  return (
    (client.tradeName?.trim() || client.businessName?.trim() || '').trim() ||
    'Cliente'
  );
}

@Injectable()
export class PendingAssignmentService {
  private readonly logger = new Logger(PendingAssignmentService.name);
  private readonly administratorRoleId = 1;

  constructor(
    @InjectRepository(PendingAssignment)
    private readonly pendingRepo: Repository<PendingAssignment>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepo: Repository<CustomerBalance>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(ReferenceCode)
    private readonly referenceCodeRepo: Repository<ReferenceCode>,
    private readonly s3Service: S3Service,
    private readonly balanceService: BalanceService,
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

  private async resolveCustomerBalanceId(clientId: number): Promise<number> {
    let cb = await this.customerBalanceRepo.findOne({
      where: { customer: { id: clientId } },
    });
    if (!cb) {
      const client = await this.clientRepo.findOne({ where: { id: clientId } });
      if (!client || client.deletedAt) {
        throw new NotFoundException('Cliente no encontrado');
      }
      cb = this.customerBalanceRepo.create({
        customer: client,
        creditBalance: '0.00',
        balance: '0.00',
      });
      cb = await this.customerBalanceRepo.save(cb);
    }
    return cb.id;
  }

  private async resolveReferenceCodeId(
    clientId: number,
    codeRaw: string,
  ): Promise<number> {
    const code = codeRaw?.trim();
    if (!code || !/^\d{8}$/.test(code)) {
      throw new BadRequestException(
        'Code inválido (debe ser numérico de 8 dígitos)',
      );
    }

    const ref = await this.referenceCodeRepo.findOne({
      where: {
        code,
        customer: { id: clientId },
        estatus: 1,
      },
      relations: { customer: true },
    });
    if (!ref) {
      throw new NotFoundException(
        'Código de referencia no encontrado o no vigente para este cliente',
      );
    }
    return ref.id;
  }

  async register(
    clientId: number,
    amount: number,
    code: string,
    voucher: Express.Multer.File,
    actor?: { userId: number },
  ) {
    if (!clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    if (!code?.trim()) {
      throw new BadRequestException('Code es obligatorio');
    }
    if (!voucher) {
      throw new BadRequestException('El comprobante (voucher) es obligatorio');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount inválido');
    }

    const referenceCodeId = await this.resolveReferenceCodeId(clientId, code);
    const customerBalanceId = await this.resolveCustomerBalanceId(clientId);
    const { url } = await this.s3Service.uploadFile(voucher, S3_VOUCHERS_FOLDER);

    this.logger.log(
      `[register] clientId=${clientId} customerBalanceId=${customerBalanceId} ` +
        `referenceCodeId=${referenceCodeId} amount=${amount}`,
    );

    let saved: PendingAssignment;
    try {
      saved = await this.pendingRepo.save(
        this.pendingRepo.create({
          customerBalance: { id: customerBalanceId } as CustomerBalance,
          amount: amount.toFixed(2),
          voucherUrl: url,
          estatus: 1,
          referenceCode: { id: referenceCodeId } as ReferenceCode,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[register] Error al guardar PendingAssignment: ${msg}`);
      if (msg.includes('ER_NO_SUCH_TABLE')) {
        throw new InternalServerErrorException(
          'La tabla PendingAssignment no existe. Ejecuta npm run migration:run',
        );
      }
      if (msg.includes('Unknown column') && msg.includes('IdReferenceCode')) {
        throw new InternalServerErrorException(
          'Falta la columna IdReferenceCode. Ejecuta npm run migration:run',
        );
      }
      throw new InternalServerErrorException(
        `No se pudo guardar PendingAssignment: ${msg}`,
      );
    }

    const persisted = await this.pendingRepo.findOne({ where: { id: saved.id } });
    if (!persisted) {
      throw new InternalServerErrorException(
        'El registro no quedó persistido en PendingAssignment',
      );
    }

    this.logger.log(`[register] OK id=${saved.id}`);

    return {
      id: saved.id,
      customerId: clientId,
      idReferenceCode: referenceCodeId,
      code: code.trim(),
      amount: saved.amount,
      voucherUrl: saved.voucherUrl,
      estatus: saved.estatus,
      createdAt: saved.createdAt,
      registeredByUserId: actor?.userId ?? null,
    };
  }

  async findPending(
    roleId: number,
    filter: FilterPendingAssignmentDto,
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

    const [rows, total] = await this.pendingRepo.findAndCount({
      where: {
        estatus: 1,
        createdAt: Between(from, to),
      },
      relations: {
        customerBalance: { customer: true },
        referenceCode: true,
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = rows.map((row) => {
      const client = row.customerBalance?.customer ?? null;
      return {
        id: row.id,
        customerBalanceId: row.customerBalance?.id ?? null,
        customerId: client?.id ?? null,
        nombreCliente: clienteNombre(client ?? undefined),
        amount: row.amount,
        voucherUrl: row.voucherUrl,
        idReferenceCode: row.referenceCode?.id ?? null,
        code: row.referenceCode?.code ?? null,
        estatus: row.estatus,
        createdAt: row.createdAt,
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

  async approve(
    roleId: number,
    id: number,
    actor?: { userId: number; clientId: number },
  ) {
    await this.assertPrivilegedAdmin(roleId);

    const row = await this.pendingRepo.findOne({
      where: { id },
      relations: { customerBalance: { customer: true }, referenceCode: true },
    });
    if (!row) {
      throw new NotFoundException('Solicitud pendiente no encontrada');
    }
    if (row.estatus !== 1) {
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    const client = row.customerBalance?.customer;
    if (!client?.id) {
      throw new BadRequestException(
        'No se pudo resolver el cliente de la solicitud',
      );
    }

    const amountNum = Number(row.amount ?? 0);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Monto inválido en la solicitud');
    }

    const assignResult = await this.balanceService.ajustarSaldoCliente(
      {
        customerId: client.id,
        requiresCredit: false,
        amount: amountNum,
      },
      actor,
    );

    row.estatus = 0;
    await this.pendingRepo.save(row);

    const referenceCodeId = row.referenceCode?.id;
    if (referenceCodeId) {
      await this.referenceCodeRepo.update(referenceCodeId, { estatus: 0 });
    }

    return {
      pendingAssignmentId: row.id,
      estatus: 0,
      idReferenceCode: referenceCodeId ?? null,
      referenceCodeEstatus: referenceCodeId ? 0 : null,
      assignBalance: assignResult,
    };
  }
}
