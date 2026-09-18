import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const ADMIN_PUSH_TEST_TYPES = [
  'transaction_error',
  'movivendor_low',
  'all',
] as const;

export type AdminPushTestType = (typeof ADMIN_PUSH_TEST_TYPES)[number];

export class TestAdminPushDto {
  @ApiPropertyOptional({
    enum: ADMIN_PUSH_TEST_TYPES,
    default: 'all',
    description:
      '`transaction_error` = tx rechazada · `movivendor_low` = saldo Movivendor · `all` = ambas',
  })
  @IsOptional()
  @IsIn(ADMIN_PUSH_TEST_TYPES)
  tipo?: AdminPushTestType;
}
