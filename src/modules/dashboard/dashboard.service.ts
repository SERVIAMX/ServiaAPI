import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { Client } from '../clients/entities/client.entity';
import { Role } from '../roles/entities/role.entity';
import { TransactionHistory } from '../transactions/entities/transaction-history.entity';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';

function toRangeString(raw: Date): string {
  return raw instanceof Date ? raw.toISOString() : String(raw);
}

function parseRangeStart(raw: Date): Date {
  const s = toRangeString(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000`);
  return new Date(s);
}

function parseRangeEnd(raw: Date): Date {
  const s = toRangeString(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59.999`);
  return new Date(s);
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

const DIA_SEMANA_ABBR = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Días calendario UTC inclusivos entre `from` y `to`. */
function diasEnRango(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cur.getTime() <= end.getTime()) {
    out.push(ymdUtc(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function diaSemanaAbbr(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  return DIA_SEMANA_ABBR[d.getUTCDay()] ?? '';
}

function ventasDiaVacio() {
  return { cantidad: 0, montoTotal: '0.00' };
}

function montoStr(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** Fecha local (servidor en `America/Mexico_City` vía `set-tz`). */
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
    @InjectRepository(TransactionHistory)
    private readonly txHistoryRepository: Repository<TransactionHistory>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /** Consultas base sobre `TransactionsHistory` (no usar tabla `Transactions`). */
  private historyQb(from: Date, to: Date, code = '0') {
    return this.txHistoryRepository
      .createQueryBuilder('th')
      .where('th.code = :code', { code })
      .andWhere('th.fhRegister >= :from', { from })
      .andWhere('th.fhRegister <= :to', { to });
  }

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
      .andWhere('th.esTAE = :esTAE', { esTAE: 1 })
      .getCount();

    const topMarcas = await this.historyQb(from, to)
      .select('th.brand', 'brand')
      .addSelect('COUNT(*)', 'cantidad')
      .andWhere('th.esTAE = :esTAE', { esTAE: 1 })
      .andWhere('th.brand IS NOT NULL')
      .andWhere("TRIM(th.brand) <> ''")
      .groupBy('th.brand')
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
      .select('th.sku', 'sku')
      .addSelect('MAX(th.brand)', 'brand')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(th.amount), 0)', 'montoTotal')
      .andWhere('th.sku IS NOT NULL')
      .andWhere("TRIM(th.sku) <> ''")
      .groupBy('th.sku')
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
      const fechaKey =
        row.fecha instanceof Date
          ? ymdUtc(row.fecha)
          : String(row.fecha ?? '').slice(0, 10);
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

    return {
      totalClientes,
      ventasHoy,
      ventasMesActual,
      pendientePago,
      operadoresMasVendidosTAE,
      productosMasVendidos,
      ventasPorCliente,
      ventasRangoFechas,
    };
  }
}
