import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MercadoPagoWebhookDto {
  @ApiProperty({ example: 'ORDTST01KSK87RMN5EPTSA5DA0142QF2' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @ApiProperty({ example: 'PAY01KSK87RNCX4XA8S2A6WMSEXEV' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  payment_id!: string;

  @ApiProperty({ example: 'processed' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty({ example: 'processed' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  payment_status!: string;

  @ApiProperty({ example: 'accredited' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  payment_status_detail!: string;

  @ApiProperty({ example: '500.00' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  total_amount!: string;

  @ApiPropertyOptional({ example: 'c_13__o_clienteluis' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  external_reference?: string;

  @ApiPropertyOptional({
    example: '13',
    description:
      'Id del cliente (Clients.Id). Si viene vacío, se obtiene de `external_reference` (formato `c_{id}__...`).',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const s = String(value).trim();
    return s === '' ? undefined : s;
  })
  @Type(() => String)
  @IsOptional()
  @IsString()
  client_id?: string;
}
