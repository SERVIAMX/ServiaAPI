import {
  LocationFields,
  withLocationFields,
} from './location-fields.util';
import { Client } from '../../modules/clients/entities/client.entity';
import { CustomerBalance } from '../../modules/clients/entities/customer-balance.entity';

export type CustomerBalanceResponse = {
  id: number;
  creditBalance: number;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientGetResponse = Omit<
  Client,
  | 'creditLine'
  | 'discountPercentage'
  | 'commissionPercentage'
  | 'customerBalance'
  | 'deletedAt'
> &
  LocationFields & {
    creditLine: number | null;
    discountPercentage: number | null;
    commissionPercentage: number | null;
    customerBalance: CustomerBalanceResponse | null;
  };

function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapCustomerBalance(
  balance: CustomerBalance | null | undefined,
): CustomerBalanceResponse | null {
  if (!balance) return null;
  return {
    id: balance.id,
    creditBalance: parseDecimal(balance.creditBalance) ?? 0,
    balance: parseDecimal(balance.balance) ?? 0,
    createdAt: balance.createdAt,
    updatedAt: balance.updatedAt,
  };
}

export function mapClientForGet(client: Client): ClientGetResponse {
  const withLocation = withLocationFields(client);
  const { creditLine, discountPercentage, commissionPercentage, ...rest } =
    withLocation;

  return {
    ...rest,
    creditLine: parseDecimal(creditLine),
    discountPercentage: parseDecimal(discountPercentage),
    commissionPercentage: parseDecimal(commissionPercentage),
    customerBalance: mapCustomerBalance(client.customerBalance),
  };
}

export function mapClientsForGet(clients: Client[]): ClientGetResponse[] {
  return clients.map(mapClientForGet);
}
