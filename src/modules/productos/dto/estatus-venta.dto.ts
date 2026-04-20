import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

/** Estatus de venta Movivendor (`check/tx`): `token` y `terminal` los resuelve el servidor. */
export class EstatusVentaDto {
  @ApiProperty({
    example: '999999000000000001',
    description: 'Identificador de la transacción a consultar (el mismo usado en la venta)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 'A', description: 'SKU del producto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  product!: string;

  @ApiProperty({ example: '0', description: 'Subproducto Movivendor' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  subprod!: string;

  @ApiProperty({ example: '55909058012', description: 'Número destino' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  destination!: string;

  @ApiProperty({ example: '10', description: 'Monto de la operación' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  amount!: string;
}
