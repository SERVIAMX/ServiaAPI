import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EjecutarVentaDto {
  @ApiProperty({
    example: '999999000000000001',
    description: 'Identificador de la transacción (negocio / correlación)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  id!: string;

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
