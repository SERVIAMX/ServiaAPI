import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'node:crypto';
import { Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import type {
  MarcasListaPaginatedResponse,
  MarcasListaPorTipoDto,
  MarcasListaPorTipoMetaItem,
  MarcasPorTipoDto,
  MovivendorServiceOffer,
  ProductoServicioDto,
  ProductoVentaSeleccionDto,
} from './productos.types';
import type { ConsultarSaldoExternoDto } from './dto/consultar-saldo-externo.dto';
import type { EstatusVentaDto } from './dto/estatus-venta.dto';
import type { EjecutarVentaDto } from './dto/ejecutar-venta.dto';
import { Transaction } from '../transactions/entities/transaction.entity';

interface MovivendorLoginData {
  token: string;
  expire_seconds?: number;
  refresh_window_seconds?: number;
  request_time?: string;
  validate_ip?: boolean;
  api_version?: string;
}

interface MovivendorLoginResponse {
  code: number;
  message?: string;
  data?: MovivendorLoginData;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function firstTruthyStr(...vals: unknown[]): string {
  for (const v of vals) {
    const s = toStr(v).trim();
    if (s) return s;
  }
  return '';
}

/** Lee grupo/tipo desde el ítem (varias claves que usa Movivendor u otros clientes). */
function rawServiceGroup(row: unknown): string {
  if (!isRecord(row)) return '';
  return firstTruthyStr(
    row.service_group,
    row.serviceGroup,
    row.service_type,
    row.serviceType,
    row.group,
    row.tipo,
    row.category,
    row.categoria,
    row.product_group,
    row.productGroup,
  );
}

/** Etiqueta estable para `tipo` / `service_group` (sin filtrar catálogo). */
function normalizeTipoLabel(g: string): string {
  return g
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Orden fijo al inicio de `marcas[]` en GET /productos/marcas (coincidencia sin mayúsculas ni espacios). */
const MARCA_PRIORITY_COMPACT = [
  'telcel',
  'movistar',
  'unefon',
  'virgin',
  'mibait',
] as const;

function compactMarcaName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

function sortMarcaNamesByPriority(marcas: string[]): string[] {
  const used = new Set<string>();
  const head: string[] = [];
  for (const slug of MARCA_PRIORITY_COMPACT) {
    const hit = marcas.find((m) => compactMarcaName(m) === slug);
    if (hit !== undefined) {
      head.push(hit);
      used.add(compactMarcaName(hit));
    }
  }
  const tail = marcas.filter((m) => !used.has(compactMarcaName(m)));
  return [...head, ...tail];
}

function injectServiceGroupIfMissing(
  items: unknown[],
  bucketLabel: string,
): unknown[] {
  return items.map((item) => {
    if (!isRecord(item)) return item;
    if (rawServiceGroup(item).trim() !== '') return item;
    return { ...item, service_group: bucketLabel };
  });
}

function isLikelyProductRow(r: unknown): boolean {
  if (!isRecord(r)) return false;
  return !!(
    r.service_name ??
    r.serviceName ??
    r.service_sku ??
    r.serviceSku ??
    r.service_group ??
    r.serviceGroup
  );
}

/** Aplana `data` con buckets por clave: cada arreglo de productos recibe `service_group` desde el nombre de la clave si falta. */
function extractFromGroupObject(obj: Record<string, unknown>): unknown[] {
  const merged: unknown[] = [];
  const skipKeys = new Set([
    'meta',
    'metadata',
    'errors',
    'pagination',
    'links',
  ]);
  for (const [key, val] of Object.entries(obj)) {
    if (!Array.isArray(val) || val.length === 0) continue;
    if (skipKeys.has(key.toLowerCase())) continue;
    if (!isLikelyProductRow(val[0])) continue;
    const label = normalizeTipoLabel(key);
    if (!label) continue;
    merged.push(...injectServiceGroupIfMissing(val, label));
  }
  return merged;
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function normalizeOffer(raw: unknown): MovivendorServiceOffer | null {
  if (!isRecord(raw)) return null;
  return {
    id: toNum(raw.id, NaN),
    amount: toNum(raw.amount),
    subprod: toNum(raw.subprod),
    plan: raw.plan === undefined || raw.plan === null ? null : toStr(raw.plan),
  };
}

function normalizeOffers(raw: unknown): MovivendorServiceOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: MovivendorServiceOffer[] = [];
  for (const o of raw) {
    const n = normalizeOffer(o);
    if (n !== null && !Number.isNaN(n.id)) out.push(n);
  }
  return out;
}

function normalizeProducto(raw: unknown): ProductoServicioDto | null {
  if (!isRecord(raw)) return null;
  const groupRaw = rawServiceGroup(raw);
  const service_group = normalizeTipoLabel(groupRaw);
  if (!service_group) return null;

  const service_name = toStr(raw.service_name ?? raw.serviceName);
  if (!service_name) return null;

  return {
    service_group,
    service_sku: toStr(raw.service_sku ?? raw.serviceSku),
    service_name,
    service_logo: toStr(raw.service_logo ?? raw.serviceLogo),
    service_last_update: toStr(
      raw.service_last_update ?? raw.serviceLastUpdate,
    ),
    service_offers: normalizeOffers(raw.service_offers ?? raw.serviceOffers),
    destination_min_length: toStr(
      raw.destination_min_length ?? raw.destinationMinLength,
    ),
    destination_max_length: toStr(
      raw.destination_max_length ?? raw.destinationMaxLength,
    ),
    destination_format: toStr(
      raw.destination_format ?? raw.destinationFormat,
    ),
  };
}

function extractProductosRaw(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!isRecord(json)) return [];
  if (Array.isArray(json.data)) return json.data;

  const d = json.data;
  if (!isRecord(d)) return [];

  for (const key of ['products', 'items', 'list'] as const) {
    const val = d[key];
    if (Array.isArray(val)) return val;
    if (isRecord(val)) {
      const nested = extractFromGroupObject(val);
      if (nested.length) return nested;
    }
  }

  const fromRoot = extractFromGroupObject(d);
  if (fromRoot.length) return fromRoot;

  return [];
}

function groupByTipoYMarca(items: ProductoServicioDto[]): MarcasPorTipoDto {
  const tipoOrder: string[] = [];
  const tipoMap = new Map<string, Map<string, ProductoServicioDto[]>>();

  for (const p of items) {
    const t = p.service_group;
    const m = p.service_name;
    if (!tipoMap.has(t)) {
      tipoOrder.push(t);
      tipoMap.set(t, new Map());
    }
    const marcas = tipoMap.get(t)!;
    if (!marcas.has(m)) marcas.set(m, []);
    marcas.get(m)!.push(p);
  }

  const grupos = tipoOrder.map((tipo) => {
    const marcasMap = tipoMap.get(tipo)!;
    const marcaOrder = sortMarcaNamesByPriority([...marcasMap.keys()]);
    const marcas = marcaOrder.map((marca) => ({
      marca,
      servicios: marcasMap.get(marca)!,
    }));
    return { tipo, marcas };
  });

  return grupos;
}

function toProductoVentaSeleccion(p: ProductoServicioDto): ProductoVentaSeleccionDto {
  return {
    service_group: p.service_group,
    service_sku: p.service_sku,
    service_name: p.service_name,
    service_logo: p.service_logo,
    destination: {
      min_length: p.destination_min_length,
      max_length: p.destination_max_length,
      format: p.destination_format,
    },
    offers: p.service_offers.map((o) => ({
      service_sku: p.service_sku,
      id: o.id,
      amount: o.amount,
      subprod: o.subprod,
      plan: o.plan,
    })),
  };
}

function mapGruposAMarcasLigeras(grupos: MarcasPorTipoDto): MarcasListaPorTipoDto {
  return grupos.map((g) => ({
    tipo: g.tipo,
    marcas: g.marcas.map((m) => {
      const conLogo = m.servicios.find((s) => s.service_logo?.trim());
      return {
        marca: m.marca,
        service_logo: conLogo?.service_logo ?? '',
      };
    }),
  }));
}

/** Coincidencia parcial en nombre de marca (`LIKE %needle%`, sin distinguir mayúsculas). */
function filterMarcasLigerasPorNombre(
  full: MarcasListaPorTipoDto,
  rawNeedle: string,
): MarcasListaPorTipoDto {
  const needle = rawNeedle.trim().toLowerCase();
  if (!needle) return full;
  return full
    .map((g) => ({
      tipo: g.tipo,
      marcas: g.marcas.filter((m) =>
        m.marca.trim().toLowerCase().includes(needle),
      ),
    }))
    .filter((g) => g.marcas.length > 0);
}

function sliceMarcasPerTipo(
  full: MarcasListaPorTipoDto,
  page: number,
  limit: number,
): { data: MarcasListaPorTipoDto; porTipo: MarcasListaPorTipoMetaItem[] } {
  const start = (page - 1) * limit;
  const data: MarcasListaPorTipoDto = [];
  const porTipo: MarcasListaPorTipoMetaItem[] = [];
  for (const g of full) {
    const total = g.marcas.length;
    const totalPages = Math.ceil(total / limit) || 1;
    porTipo.push({ tipo: g.tipo, total, totalPages });
    const marcas = g.marcas.slice(start, start + limit);
    if (marcas.length === 0) continue;
    data.push({ tipo: g.tipo, marcas });
  }
  return { data, porTipo };
}

@Injectable()
export class ProductosService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  private cfg(key: string): string | undefined {
    const v = this.config.get<string>(key);
    return typeof v === 'string' ? v.trim() : v;
  }

  /** Correlación numérica de 12 dígitos para consulta de saldo (Movivendor `id`). */
  private generarIdConsultaSaldo12(): string {
    return randomInt(0, 1_000_000_000_000).toString().padStart(12, '0');
  }

  /**
   * Obtiene token de sesión en Movivendor (no expuesto vía HTTP).
   */
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
      throw new BadGatewayException(
        json.message ?? 'Movivendor login rechazado',
      );
    }

    return json.data.token;
  }

  private async fetchProductosNormalizados(): Promise<ProductoServicioDto[]> {
    const token = await this.loginMovivendor();
    const url = this.cfg('MOVIVENDOR_PRODUCTOS');
    if (!url) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_PRODUCTOS en configuración',
      );
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      throw new BadGatewayException(
        'No se pudo conectar con Movivendor (productos)',
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadGatewayException('Respuesta inválida de Movivendor (productos)');
    }

    if (!res.ok) {
      const msg =
        typeof json === 'object' &&
        json !== null &&
        'message' in json &&
        typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : `Movivendor productos HTTP ${res.status}`;
      throw new BadGatewayException(msg);
    }

    if (isRecord(json) && typeof json.code === 'number' && json.code !== 0) {
      const msg =
        typeof json.message === 'string'
          ? json.message
          : 'Movivendor productos rechazado';
      throw new BadGatewayException(msg);
    }

    const rawList = extractProductosRaw(json);
    const servicios: ProductoServicioDto[] = [];
    for (const row of rawList) {
      const p = normalizeProducto(row);
      if (p) servicios.push(p);
    }
    return servicios;
  }

  /**
   * Por cada tipo del catálogo: solo `marca` y `service_logo` por marca.
   * Paginación por tipo: cada bloque trae hasta `limit` marcas de ese tipo (misma `page` para todos); por defecto 6.
   */
  async getMarcas(
    page: number,
    limit: number,
  ): Promise<MarcasListaPaginatedResponse> {
    const servicios = await this.fetchProductosNormalizados();
    const grupos = groupByTipoYMarca(servicios);
    const full = mapGruposAMarcasLigeras(grupos);
    const { data, porTipo } = sliceMarcasPerTipo(full, page, limit);
    return {
      data,
      meta: { page, limit, porTipo },
    };
  }

  /**
   * Igual que `getMarcas` (formato y paginación por tipo), pero solo marcas cuyo nombre contiene `nombre`
   * (subcadena, sin distinguir mayúsculas; equivalente a `LIKE %nombre%`).
   */
  async getMarcasPorNombre(
    nombre: string,
    page: number,
    limit: number,
  ): Promise<MarcasListaPaginatedResponse> {
    const servicios = await this.fetchProductosNormalizados();
    const grupos = groupByTipoYMarca(servicios);
    const full = mapGruposAMarcasLigeras(grupos);
    const filtered = filterMarcasLigerasPorNombre(full, nombre);
    const { data, porTipo } = sliceMarcasPerTipo(filtered, page, limit);
    return {
      data,
      meta: { page, limit, porTipo },
    };
  }

  /**
   * Misma fuente que `getMarcas`; filtra por `service_name` (coincidencia sin distinguir mayúsculas).
   * Respuesta recortada para la app: logo, SKU, destino y ofertas con `id` para integrar con `ejecutarTx`.
   */
  async getProductosPorMarca(
    marca: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ProductoVentaSeleccionDto>> {
    const all = await this.fetchProductosNormalizados();
    const needle = marca.trim().toLowerCase();
    const filtered = all.filter(
      (p) => p.service_name.trim().toLowerCase() === needle,
    );
    const total = filtered.length;
    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);
    const data = slice.map(toProductoVentaSeleccion);
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

  /**
   * POST Movivendor `do/tx`: token por login interno; el cliente no envía token.
   */

  
  async ejecutarVenta(dto: EjecutarVentaDto): Promise<unknown> {
    console.log('ejecutarVenta', dto);
    const url = this.cfg('MOVIVENDOR_VENTA');
    if (!url) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_VENTA en configuración',
      );
    }

    const token = await this.loginMovivendor();
    const terminal =
      dto.terminal?.trim() || this.cfg('MOVIVENDOR_TERMINAL') || '';
    if (!terminal) {
      throw new InternalServerErrorException(
        'Falta terminal: envíalo en el body o define MOVIVENDOR_TERMINAL',
      );
    }

    const payload = {
      token,
      id: dto.id,
      terminal,
      product: dto.product,
      subprod: dto.subprod,
      destination: dto.destination,
      amount: dto.amount,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con Movivendor (venta)');
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadGatewayException('Respuesta inválida de Movivendor (venta)');
    }

    if (!res.ok) {
      const msg =
        isRecord(json) && typeof json.message === 'string'
          ? json.message
          : `Movivendor venta HTTP ${res.status}`;
      throw new BadGatewayException(msg);
    }

    // Si viene idTransaction, actualiza code y ResponseProvider en Transactions
    if (dto.idTransaction !== undefined && dto.idTransaction !== null) {
      const code =
        isRecord(json) && typeof json.code === 'number'
          ? String(json.code)
          : '';
      await this.txRepo.update(
        { idTransaction: dto.idTransaction },
        {
          ...(code ? { code } : {}),
          responseProvider: json as any,
        },
      );
    }

    return json;
  }

  /**
   * POST Movivendor `check/tx` (estatus venta): token por login; `terminal` solo desde `MOVIVENDOR_TERMINAL`.
   */
  async estatusVenta(dto: EstatusVentaDto): Promise<unknown> {
    const url = this.cfg('MOVIVENDOR_ESTATUS_VENTA');
    if (!url) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_ESTATUS_VENTA en configuración',
      );
    }

    const token = await this.loginMovivendor();
    const terminal = this.cfg('MOVIVENDOR_TERMINAL') || '';
    if (!terminal) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_TERMINAL en configuración',
      );
    }

    const payload = {
      token,
      id: dto.id,
      terminal,
      product: dto.product,
      subprod: dto.subprod,
      destination: dto.destination,
      amount: dto.amount,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException(
        'No se pudo conectar con Movivendor (estatus venta)',
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadGatewayException(
        'Respuesta inválida de Movivendor (estatus venta)',
      );
    }

    if (!res.ok) {
      const msg =
        isRecord(json) && typeof json.message === 'string'
          ? json.message
          : `Movivendor estatus venta HTTP ${res.status}`;
      throw new BadGatewayException(msg);
    }

    return json;
  }

  /**
   * POST Movivendor `query/tx` (consultar saldo externo): token por login interno; el cliente no envía token.
   */
  async consultarSaldoExterno(
    dto: ConsultarSaldoExternoDto,
  ): Promise<unknown> {
    const url = this.cfg('MOVIVENDOR_CONSULTAR_SALDO_EXTERNO');
    if (!url) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_CONSULTAR_SALDO_EXTERNO en configuración',
      );
    }

    const token = await this.loginMovivendor();
    const terminal =
      dto.terminal?.trim() || this.cfg('MOVIVENDOR_TERMINAL') || '';
    if (!terminal) {
      throw new InternalServerErrorException(
        'Falta terminal: envíalo en el body o define MOVIVENDOR_TERMINAL',
      );
    }

    const payload = {
      token,
      id: this.generarIdConsultaSaldo12(),
      terminal,
      product: dto.product,
      subprod: dto.subprod,
      destination: dto.destination,
      amount: dto.amount,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BadGatewayException(
        'No se pudo conectar con Movivendor (consultar saldo externo)',
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadGatewayException(
        'Respuesta inválida de Movivendor (consultar saldo externo)',
      );
    }

    if (!res.ok) {
      const msg =
        isRecord(json) && typeof json.message === 'string'
          ? json.message
          : `Movivendor consultar saldo externo HTTP ${res.status}`;
      throw new BadGatewayException(msg);
    }

    return json;
  }
}

