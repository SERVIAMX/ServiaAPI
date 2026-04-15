import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Cuerpo de consulta; `id` y `token` los genera el servidor. */
export class ConsultarSaldoExternoDto {
  @ApiProperty({ example: 'CFE', description: 'Código de producto Movivendor' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  product!: string;

  @ApiProperty({ example: '0', description: 'Subproducto Movivendor' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  subprod!: string;

  @ApiProperty({
    example: '011389002004812311240000002916',
    description: 'Referencia de destino según el producto',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  destination!: string;

  @ApiProperty({ example: '0', description: 'Monto (p. ej. 0 para solo consulta de saldo)' })
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
