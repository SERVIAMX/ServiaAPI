import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { Role } from '../roles/entities/role.entity';
import { CreateSupplierPurchaseDto } from './dto/create-supplier-purchase.dto';
import { FilterSupplierPurchasesDto } from './dto/filter-supplier-purchases.dto';
import { SupplierPurchase } from './entities/supplier-purchase.entity';

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
export class SupplierPurchasesService {
  private readonly administratorRoleId = 1;

  constructor(
    @InjectRepository(SupplierPurchase)
    private readonly purchaseRepo: Repository<SupplierPurchase>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  private async assertSuperAdministrador(roleId?: number): Promise<void> {
    if (roleId == null) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new ForbiddenException('Sin rol asignado');
    }
    const nameNorm = role.name?.trim().toLowerCase() ?? '';
    const isSuperByName = nameNorm === 'super administrador';
    const isPortalAdmin = role.id === this.administratorRoleId;
    if (!isSuperByName && !isPortalAdmin) {
      throw new ForbiddenException(
        'Solo Super Administrador puede registrar compras a proveedor',
      );
    }
  }

  async create(
    dto: CreateSupplierPurchaseDto,
    auth: { roleId?: number },
  ): Promise<SupplierPurchase> {
    await this.assertSuperAdministrador(auth.roleId);

    const amount = Number(dto.amount);
    const amountReceived = Number((amount * 1.073).toFixed(2));

    const row = this.purchaseRepo.create({
      amount: amount.toFixed(2),
      amountReceived: amountReceived.toFixed(2),
      type: dto.type,
    });
    return this.purchaseRepo.save(row);
  }

  async findByDateRange(
    filter: FilterSupplierPurchasesDto,
  ): Promise<PaginatedResult<SupplierPurchase>> {
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

    const [data, total] = await this.purchaseRepo.findAndCount({
      where: { fhRegistro: Between(from, to) },
      order: { fhRegistro: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
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
}
