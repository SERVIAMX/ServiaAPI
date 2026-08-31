import {
  LocationFields,
  withLocationFields,
} from './location-fields.util';
import { Client } from '../../modules/clients/entities/client.entity';
import { CustomerBalance } from '../../modules/clients/entities/customer-balance.entity';

function mapCustomerBalance(
  balance: CustomerBalance | null | undefined,
): CustomerBalance | null {
  if (!balance) return null;
  return {
    id: balance.id,
    creditBalance: balance.creditBalance,
    balance: balance.balance,
    createdAt: balance.createdAt,
    updatedAt: balance.updatedAt,
  } as CustomerBalance;
}

export function mapClientForGet(
  client: Client,
): Client & LocationFields & { customerBalance: CustomerBalance | null } {
  const withLocation = withLocationFields(client);
  return {
    ...withLocation,
    customerBalance: mapCustomerBalance(client.customerBalance),
  };
}

export function mapClientsForGet(
  clients: Client[],
): Array<
  Client & LocationFields & { customerBalance: CustomerBalance | null }
> {
  return clients.map(mapClientForGet);
}
