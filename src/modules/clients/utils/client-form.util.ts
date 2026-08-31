import { BadRequestException } from '@nestjs/common';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';

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

function parseFormBoolean(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return undefined;
}

export function parseCreateClientFormBody(
  body: Record<string, unknown>,
): CreateClientDto {
  const businessName = parseFormString(
    pick(body, 'businessName', 'BusinessName'),
  );
  const email = parseFormString(pick(body, 'email', 'Email'));
  const requiresCredit = parseFormBoolean(
    pick(body, 'requiresCredit', 'RequiresCredit'),
  );

  if (!businessName) {
    throw new BadRequestException('businessName es requerido');
  }
  if (!email) {
    throw new BadRequestException('email es requerido');
  }
  if (requiresCredit === undefined) {
    throw new BadRequestException('requiresCredit es requerido');
  }

  return {
    businessName,
    email,
    requiresCredit,
    tradeName: parseFormString(pick(body, 'tradeName', 'TradeName')),
    rfc: parseFormString(pick(body, 'rfc', 'RFC')),
    phone: parseFormString(pick(body, 'phone', 'Phone')),
    address: parseFormString(pick(body, 'address', 'Address')),
    city: parseFormString(pick(body, 'city', 'City')),
    state: parseFormString(pick(body, 'state', 'State')),
    postalCode: parseFormString(pick(body, 'postalCode', 'PostalCode')),
    country: parseFormString(pick(body, 'country', 'Country')),
    notes: parseFormString(pick(body, 'notes', 'Notes')),
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

export function parseUpdateClientFormBody(
  body: Record<string, unknown>,
): UpdateClientDto {
  const dto: UpdateClientDto = {};

  const businessName = parseFormString(
    pick(body, 'businessName', 'BusinessName'),
  );
  if (businessName !== undefined) dto.businessName = businessName;

  const email = parseFormString(pick(body, 'email', 'Email'));
  if (email !== undefined) dto.email = email;

  const requiresCredit = parseFormBoolean(
    pick(body, 'requiresCredit', 'RequiresCredit'),
  );
  if (requiresCredit !== undefined) dto.requiresCredit = requiresCredit;

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

  const amount = parseFormNumber(pick(body, 'amount', 'Amount'));
  if (amount !== undefined) dto.amount = amount;

  const creditLine = parseFormNumber(pick(body, 'creditLine', 'CreditLine'));
  if (creditLine !== undefined) dto.creditLine = creditLine;

  const discountPercentage = parseFormNumber(
    pick(body, 'discountPercentage', 'DiscountPercentage'),
  );
  if (discountPercentage !== undefined) dto.discountPercentage = discountPercentage;

  const commissionPercentage = parseFormNumber(
    pick(body, 'commissionPercentage', 'CommissionPercentage'),
  );
  if (commissionPercentage !== undefined) {
    dto.commissionPercentage = commissionPercentage;
  }

  const creditBalance = parseFormNumber(
    pick(body, 'creditBalance', 'CreditBalance'),
  );
  if (creditBalance !== undefined) dto.creditBalance = creditBalance;

  return dto;
}
