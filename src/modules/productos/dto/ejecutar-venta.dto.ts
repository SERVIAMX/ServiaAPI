import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EjecutarVentaDto {
  @ApiPropertyOptional({
    description:
      'IdTransaction interno para actualizar Transactions.code con el code de Movivendor',
    example: 123,
  })
  @IsOptional()
  idTransaction?: number;

  @ApiPropertyOptional({
    example: 'tiempo_aire',
    description: 'Tipo de transacción (default: tiempo_aire)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ example: 'Telcel' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    example: '00030003000606193249',
    description:
      'Identificador Movivendor (numérico, 12–20 dígitos). Si se omite o envías IdTransaction corto (ej. `516`), se resuelve desde `Transactions.externalId` o se genera uno nuevo.',
  })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    return typeof value === 'string' ? value.trim() : String(value).trim();
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'A', description: 'SKU del producto (ej. oferta `service_sku`)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  product!: string;

  @ApiProperty({ example: '0', description: 'Subproducto Movivendor' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  subprod!: string;

  @ApiProperty({ example: '55909058012', description: 'Número destino (10 dígitos según producto)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  destination!: string;

  @ApiProperty({ example: '10', description: 'Monto de la recarga' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional({
    description:
      'Terminal Movivendor; si se omite se usa `MOVIVENDOR_TERMINAL` del servidor',
    example: 'rdev1',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  terminal?: string;
}
