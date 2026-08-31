import { BadRequestException } from '@nestjs/common';
import {
  isProspectEstatus,
  ProspectEstatus,
} from '../../../common/enums/prospect-estatus.enum';
import { ConvertProspectDto } from '../dto/convert-prospect.dto';
import { CreateProspectDto } from '../dto/create-prospect.dto';
import { UpdateProspectDto } from '../dto/update-prospect.dto';

function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const v = body[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function parseFormString(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  return s.length ? s : undefined;
}

function parseFormNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/,/g, '');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseFormEstatus(raw: unknown): ProspectEstatus | undefined {
  const n = parseFormNumber(raw);
  if (n === undefined) return undefined;
  if (!isProspectEstatus(n)) {
    throw new BadRequestException(
      'estatus inválido. Use 1=Nuevo, 2=En seguimiento, 3=Convertido, 4=Descartado',
    );
  }
  return n;
}

export function parseCreateProspectFormBody(
  body: Record<string, unknown>,
): CreateProspectDto {
  const businessName = parseFormString(
    pick(body, 'businessName', 'BusinessName'),
  );
  const email = parseFormString(pick(body, 'email', 'Email'));

  if (!businessName) {
    throw new BadRequestException('businessName es requerido');
  }
  if (!email) {
    throw new BadRequestException('email es requerido');
  }

  return {
    businessName,
    email,
    tradeName: parseFormString(pick(body, 'tradeName', 'TradeName')),
    rfc: parseFormString(pick(body, 'rfc', 'RFC')),
    phone: parseFormString(pick(body, 'phone', 'Phone')),
    address: parseFormString(pick(body, 'address', 'Address')),
    city: parseFormString(pick(body, 'city', 'City')),
    state: parseFormString(pick(body, 'state', 'State')),
    postalCode: parseFormString(pick(body, 'postalCode', 'PostalCode')),
    country: parseFormString(pick(body, 'country', 'Country')),
    notes: parseFormString(pick(body, 'notes', 'Notes')),
    estatus: parseFormEstatus(pick(body, 'estatus', 'Estatus')),
    lat: parseFormNumber(pick(body, 'lat', 'Lat')),
    lng: parseFormNumber(pick(body, 'lng', 'Lng')),
    neighborhood: parseFormString(
      pick(body, 'neighborhood', 'Neighborhood'),
    ),
  };
}

export function parseUpdateProspectFormBody(
  body: Record<string, unknown>,
): UpdateProspectDto {
  const dto: UpdateProspectDto = {};

  const businessName = parseFormString(
    pick(body, 'businessName', 'BusinessName'),
  );
  if (businessName !== undefined) dto.businessName = businessName;

  const email = parseFormString(pick(body, 'email', 'Email'));
  if (email !== undefined) dto.email = email;

  const tradeName = parseFormString(pick(body, 'tradeName', 'TradeName'));
  if (tradeName !== undefined) dto.tradeName = tradeName;

  const rfc = parseFormString(pick(body, 'rfc', 'RFC'));
  if (rfc !== undefined) dto.rfc = rfc;

  const phone = parseFormString(pick(body, 'phone', 'Phone'));
  if (phone !== undefined) dto.phone = phone;

  const address = parseFormString(pick(body, 'address', 'Address'));
  if (address !== undefined) dto.address = address;

  const city = parseFormString(pick(body, 'city', 'City'));
  if (city !== undefined) dto.city = city;

  const state = parseFormString(pick(body, 'state', 'State'));
  if (state !== undefined) dto.state = state;

  const postalCode = parseFormString(pick(body, 'postalCode', 'PostalCode'));
  if (postalCode !== undefined) dto.postalCode = postalCode;

  const country = parseFormString(pick(body, 'country', 'Country'));
  if (country !== undefined) dto.country = country;

  const notes = parseFormString(pick(body, 'notes', 'Notes'));
  if (notes !== undefined) dto.notes = notes;

  const lat = parseFormNumber(pick(body, 'lat', 'Lat'));
  if (lat !== undefined) dto.lat = lat;

  const lng = parseFormNumber(pick(body, 'lng', 'Lng'));
  if (lng !== undefined) dto.lng = lng;

  const neighborhood = parseFormString(
    pick(body, 'neighborhood', 'Neighborhood'),
  );
  if (neighborhood !== undefined) dto.neighborhood = neighborhood;

  return dto;
}

function parseFormBoolean(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return undefined;
}

function parseFormBooleanRequired(
  raw: unknown,
  field: string,
): boolean {
  const value = parseFormBoolean(raw);
  if (value === undefined) {
    throw new BadRequestException(`${field} es requerido`);
  }
  return value;
}

export function parseConvertProspectFormBody(
  body: Record<string, unknown>,
): ConvertProspectDto {
  const requiresCredit = parseFormBooleanRequired(
    pick(body, 'requiresCredit', 'RequiresCredit'),
    'requiresCredit',
  );

  return {
    requiresCredit,
    amount: parseFormNumber(pick(body, 'amount', 'Amount')),
    creditLine: parseFormNumber(pick(body, 'creditLine', 'CreditLine')),
    discountPercentage: parseFormNumber(
      pick(body, 'discountPercentage', 'DiscountPercentage'),
    ),
    commissionPercentage: parseFormNumber(
      pick(body, 'commissionPercentage', 'CommissionPercentage'),
    ),
    creditBalance: parseFormNumber(
      pick(body, 'creditBalance', 'CreditBalance'),
    ),
  };
}
