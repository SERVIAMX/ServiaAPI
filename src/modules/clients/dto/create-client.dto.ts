import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  businessName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @ApiPropertyOptional({
    description: 'RFC mexicano',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i, {
    message: 'RFC con formato mexicano inválido',
  })
  rfc?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description:
      'Si es true, el cliente requiere crédito (debe enviar CreditBalance > 0). Si es false, debe enviar Amount > 0.',
    example: true,
  })
  @IsBoolean()
  requiresCredit: boolean;

  @ApiPropertyOptional({
    description:
      'Monto pagado inicial (solicitado). Requerido si RequiresCredit = false. En CustomerBalance.Balance se acredita con bonificación por DiscountPercentage (igual que assignBalance).',
    example: 200,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'Línea de crédito máxima. Se valida el CreditBalance solicitado (sin bono) contra CreditLine; el saldo acreditado sí puede superar CreditLine por bonificación.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLine?: number;

  @ApiPropertyOptional({
    description:
      'Porcentaje de bonificación sobre saldo inicial (ej. 10 => 1000 financiados acreditan 1100). Igual que assignBalance.',
    example: 10.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de comisión para el cliente (ej. 3.25).',
    example: 3.25,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  commissionPercentage?: number;

  @ApiPropertyOptional({
    description:
      'Monto de crédito solicitado (financiado). Si RequiresCredit=true debe ser > 0 y ≤ CreditLine. En CustomerBalance.CreditBalance se guarda el Acreditado con bonificación.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditBalance?: number;
}
