import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckStatusDto {
  @ApiProperty({
    example: '00090004260619162643',
    description:
      'ExternalId de la transacción (se busca en Transactions y, si no existe, en TransactionsHistory)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  externalId!: string;
}
