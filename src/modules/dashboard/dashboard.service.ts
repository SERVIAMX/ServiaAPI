import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { TransactionHistory } from '../transactions/entities/transaction-history.entity';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';

function parseRangeStart(raw: Date): Date {
  const d = raw instanceof Date ? raw : new Date(raw);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function parseRangeEnd(raw: Date): Date {
  const d = raw instanceof Date ? raw : new Date(raw);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

const DIA_SEMANA_ABBR = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Días calendario local inclusivos entre `from` y `to`. */
function diasEnRango(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur.getTime() <= end.getTime()) {
    out.push(ymdLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function diaSemanaAbbr(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return DIA_SEMANA_ABBR[dt.getDay()] ?? '';
}

function ymdFromQueryDate(val: string | Date | null | undefined): string {
  if (val instanceof Date) return ymdLocal(val);
  return String(val ?? '').slice(0, 10);
}

function ventasDiaVacio() {
  return { cantidad: 0, montoTotal: '0.00' };
}

function montoStr(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** Fecha local (servidor en `America/Mexico_City` vía `set-tz`). */
function rangoHoyLocal(): { from: Date; to: Date; fecha: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to, fecha: ymdLocal(now) };
}

function rangoMesActualLocal(): { from: Date; to: Date; mes: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m, 1, 0, 0, 0, 0);
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = new Date(y, m, lastDay, 23, 59, 59, 999);
  const mes = `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from, to, mes };
}

/**
 * Dashboard: métricas de recargas/ventas desde `TransactionsHistory` (`code = '0'`).
 * `totalClientes` → `Clients`. `ventasHoy` / `ventasMesActual` → `BalanceHistory` (`isPaid = 1`).
 * `pendientePago` → `BalanceHistory` (`isPaid = 0`, saldo pendiente global).
 */
@Injectable()
export class DashboardService {
  private readonly administratorRoleId = 1;

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(BalanceHistory)
    private readonly balanceHistoryRepository: Repository<BalanceHistory>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepository: Repository<CustomerBalance>,
    @InjectRepository(TransactionHistory)
    private readonly txHistoryRepository: Repository<TransactionHistory>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /** Ventas exitosas en `TransactionsHistory` (`code` = 0, no vacío). */
  private historyQb(from: Date, to: Date) {
    return this.txHistoryRepository
      .createQueryBuilder('th')
      .where("TRIM(CAST(th.code AS CHAR)) = '0'")
      .andWhere('th.fhRegister >= :from', { from })
      .andWhere('th.fhRegister <= :to', { to });
  }

  private exprMarcaTae = `COALESCE(NULLIF(TRIM(th.brand), ''), NULLIF(TRIM(th.sku), ''), 'Sin marca')`;

  private exprSkuProducto = `COALESCE(NULLIF(TRIM(th.sku), ''), 'Sin SKU')`;

  /** `BalanceHistory` por `isPaid` y rango opcional en `fhRegistro`. */
  private async resumenBalanceHistory(
    isPaid: number,
    from?: Date,
    to?: Date,
  ) {
    const qb = this.balanceHistoryRepository
      .createQueryBuilder('bh')
      .where('bh.isPaid = :paid', { paid: isPaid });
    if (from != null && to != null) {
      qb.andWhere('bh.fhRegistro >= :from', { from }).andWhere(
        'bh.fhRegistro <= :to',
        { to },
      );
    }
    const raw = await qb
      .select('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(bh.amount), 0)', 'montoTotal')
      .getRawOne<{ cantidad: string; montoTotal: string }>();
    return {
      cantidad: Number(raw?.cantidad ?? 0) || 0,
      montoTotal: montoStr(Number(raw?.montoTotal ?? 0)),
    };
  }

  private async assertPrivilegedAdmin(roleId: number): Promise<void> {
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
        'Solo Super Administrador o Administrador pueden consultar el dashboard',
      );
    }
  }

  /** Rango del body; sin fechas → día actual (México). */
  private resolveRangoFiltro(dto: DashboardFilterDto): { from: Date; to: Date } {
    const hasInicio = dto.fechaInicio != null;
    const hasFin = dto.fechaFin != null;
    if (!hasInicio && !hasFin) {
      const hoy = rangoHoyLocal();
      return { from: hoy.from, to: hoy.to };
    }
    if (hasInicio !== hasFin) {
      throw new BadRequestException(
        'Envía fechaInicio y fechaFin juntas, u omite ambas para usar el día actual',
      );
    }
    const from = parseRangeStart(dto.fechaInicio!);
    const to = parseRangeEnd(dto.fechaFin!);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('El rango de fechas es inválido (fechaInicio > fechaFin)');
    }
    return { from, to };
  }

  async obtenerDashboard(roleId: number, dto: DashboardFilterDto) {
    await this.assertPrivilegedAdmin(roleId);

    const { from, to } = this.resolveRangoFiltro(dto);

    // Única métrica que no usa TransactionsHistory
    const totalClientes = await this.clientRepository.count({
      where: { deletedAt: IsNull() },
    });

    const hoy = rangoHoyLocal();
    const mes = rangoMesActualLocal();
    const [resumenHoy, resumenMes, pendientePago] = await Promise.all([
      this.resumenBalanceHistory(1, hoy.from, hoy.to),
      this.resumenBalanceHistory(1, mes.from, mes.to),
      this.resumenBalanceHistory(0),
    ]);
    const ventasHoy = { fecha: hoy.fecha, ...resumenHoy };
    const ventasMesActual = { mes: mes.mes, ...resumenMes };

    const totalTaeExitosas = await this.historyQb(from, to)
      .andWhere('(th.esTAE = 1 OR th.esTAE = TRUE)')
      .getCount();

    const topMarcas = await this.historyQb(from, to)
      .select(this.exprMarcaTae, 'brand')
      .addSelect('COUNT(*)', 'cantidad')
      .andWhere('(th.esTAE = 1 OR th.esTAE = TRUE)')
      .groupBy(this.exprMarcaTae)
      .orderBy('COUNT(*)', 'DESC')
      .limit(5)
      .getRawMany<{ brand: string; cantidad: string }>();

    const operadoresMasVendidosTAE = topMarcas.map((row) => {
      const cantidad = Number(row.cantidad) || 0;
      const brand = String(row.brand ?? '').trim() || 'Sin marca';
      return {
        brand,
        cantidad,
        porcentaje: pct(cantidad, totalTaeExitosas),
      };
    });

    const totalVentasExitosas = await this.historyQb(from, to).getCount();

    const topProductos = await this.historyQb(from, to)
      .select(this.exprSkuProducto, 'sku')
      .addSelect('MAX(th.brand)', 'brand')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(th.amount), 0)', 'montoTotal')
      .groupBy(this.exprSkuProducto)
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany<{
        sku: string;
        brand: string | null;
        cantidad: string;
        montoTotal: string;
      }>();

    const productosMasVendidos = topProductos.map((row) => {
      const cantidad = Number(row.cantidad) || 0;
      return {
        sku: String(row.sku ?? '').trim() || 'Sin SKU',
        brand: String(row.brand ?? '').trim() || null,
        cantidad,
        montoTotal: Number(row.montoTotal ?? 0).toFixed(2),
        porcentaje: pct(cantidad, totalVentasExitosas),
      };
    });

    const ventasPorDiaRaw = await this.historyQb(from, to)
      .select('DATE(th.fhRegister)', 'fecha')
      .addSelect('th.esTAE', 'esTAE')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(th.amount), 0)', 'montoTotal')
      .groupBy('DATE(th.fhRegister)')
      .addGroupBy('th.esTAE')
      .getRawMany<{
        fecha: string | Date;
        esTAE: number | string | null;
        cantidad: string;
        montoTotal: string;
      }>();

    const ventasPorDiaMap = new Map<
      string,
      { tae: { cantidad: number; montoTotal: string }; servicios: { cantidad: number; montoTotal: string } }
    >();

    for (const row of ventasPorDiaRaw) {
      const fechaKey = ymdFromQueryDate(row.fecha);
      if (!fechaKey) continue;

      if (!ventasPorDiaMap.has(fechaKey)) {
        ventasPorDiaMap.set(fechaKey, {
          tae: ventasDiaVacio(),
          servicios: ventasDiaVacio(),
        });
      }
      const bucket = ventasPorDiaMap.get(fechaKey)!;
      const target = Number(row.esTAE) === 1 ? bucket.tae : bucket.servicios;
      target.cantidad += Number(row.cantidad) || 0;
      target.montoTotal = (
        Number(target.montoTotal) + Number(row.montoTotal ?? 0)
      ).toFixed(2);
    }

    const ventasRangoFechas = diasEnRango(from, to).map((fecha) => {
      const data = ventasPorDiaMap.get(fecha) ?? {
        tae: ventasDiaVacio(),
        servicios: ventasDiaVacio(),
      };
      return {
        fecha,
        diaSemana: diaSemanaAbbr(fecha),
        tae: { ...data.tae },
        servicios: { ...data.servicios },
      };
    });

    const topClientesRaw = await this.historyQb(from, to)
      .innerJoin('th.user', 'u')
      .innerJoin('u.client', 'c')
      .andWhere('c.deletedAt IS NULL')
      .select('c.id', 'clientId')
      .addSelect(
        "COALESCE(NULLIF(TRIM(c.tradeName), ''), c.businessName)",
        'nombre',
      )
      .addSelect('c.city', 'ciudad')
      .addSelect('COUNT(*)', 'totalTransacciones')
      .addSelect('COALESCE(SUM(th.amount), 0)', 'montoTotal')
      .addSelect(
        'COALESCE(SUM(CASE WHEN th.esTAE = 1 THEN th.amount ELSE 0 END), 0)',
        'montoTae',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN th.esTAE = 0 OR th.esTAE IS NULL THEN th.amount ELSE 0 END), 0)',
        'montoServicios',
      )
      .groupBy('c.id')
      .addGroupBy('c.businessName')
      .addGroupBy('c.tradeName')
      .addGroupBy('c.city')
      .orderBy('SUM(th.amount)', 'DESC')
      .limit(4)
      .getRawMany<{
        clientId: string;
        nombre: string;
        ciudad: string | null;
        totalTransacciones: string;
        montoTotal: string;
        montoTae: string;
        montoServicios: string;
      }>();

    const ventasPorCliente = topClientesRaw.map((row) => {
      const montoTotal = Number(row.montoTotal) || 0;
      const montoTae = Number(row.montoTae) || 0;
      const montoServicios = Number(row.montoServicios) || 0;
      return {
        clientId: Number(row.clientId),
        nombre: String(row.nombre ?? '').trim() || 'Cliente',
        ubicacion: String(row.ciudad ?? '').trim() || null,
        montoTotal: montoStr(montoTotal),
        totalTransacciones: Number(row.totalTransacciones) || 0,
        tae: {
          monto: montoStr(montoTae),
          porcentaje: pct(montoTae, montoTotal),
        },
        servicios: {
          monto: montoStr(montoServicios),
          porcentaje: pct(montoServicios, montoTotal),
        },
      };
    });

    const topSaldoRaw = await this.customerBalanceRepository
      .createQueryBuilder('cb')
      .innerJoin('cb.customer', 'c')
      .where('c.deletedAt IS NULL')
      .select(
        "COALESCE(NULLIF(TRIM(c.tradeName), ''), c.businessName)",
        'nombreCliente',
      )
      .addSelect('cb.balance', 'saldo')
      .orderBy('CAST(cb.balance AS DECIMAL(12,2))', 'DESC')
      .limit(4)
      .getRawMany<{ nombreCliente: string; saldo: string }>();

    const saldoPorCliente = topSaldoRaw.map((row) => ({
      nombreCliente: String(row.nombreCliente ?? '').trim() || 'Cliente',
      saldo: Number(row.saldo) || 0,
    }));

    return {
      totalClientes,
      ventasHoy,
      ventasMesActual,
      pendientePago,
      operadoresMasVendidosTAE,
      productosMasVendidos,
      ventasPorCliente,
      saldoPorCliente,
      ventasRangoFechas,
    };
  }
}
