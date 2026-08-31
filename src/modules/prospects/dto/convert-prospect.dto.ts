import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class ConvertProspectDto {
  @ApiProperty({
    description:
      'Si es true, el cliente requiere crédito (debe enviar creditBalance > 0). Si es false, debe enviar amount > 0.',
    example: true,
  })
  @IsBoolean()
  requiresCredit: boolean;

  @ApiPropertyOptional({
    description: 'Monto pagado inicial. Requerido si requiresCredit = false.',
    example: 200,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Línea de crédito máxima. Requerido si requiresCredit = true.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLine?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de bonificación sobre saldo inicial. Mínimo 1.',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1, {
    message: 'discountPercentage debe ser al menos 1 (no se permiten 0 ni 0.x)',
  })
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de comisión para el cliente. Mínimo 1.',
    example: 3.25,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1, {
    message: 'commissionPercentage debe ser al menos 1 (no se permiten 0 ni 0.x)',
  })
  commissionPercentage?: number;

  @ApiPropertyOptional({
    description:
      'Monto de crédito solicitado. Requerido si requiresCredit = true.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditBalance?: number;
}
