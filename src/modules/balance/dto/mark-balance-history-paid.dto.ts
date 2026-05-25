import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class MarkBalanceHistoryPaidDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del registro en `BalanceHistory` (pendiente: `isPaid = 0`)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  balanceHistoryId!: number;
}
