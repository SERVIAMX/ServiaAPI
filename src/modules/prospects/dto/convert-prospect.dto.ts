import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class ConvertProspectDto {
  @ApiProperty({
    description:
      'Obligatorio. Si es true, el cliente requiere crédito (debe enviar creditBalance > 0 y creditLine). Si es false, debe enviar amount > 0.',
    example: true,
  })
  @IsBoolean()
  requiresCredit: boolean;

  @ApiPropertyOptional({
    description: 'Condicional: obligatorio si requiresCredit=false (debe ser > 0).',
    example: 200,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Condicional: obligatorio si requiresCredit=true.',
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
      'Condicional: obligatorio si requiresCredit=true (debe ser > 0 y ≤ creditLine).',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditBalance?: number;
}
