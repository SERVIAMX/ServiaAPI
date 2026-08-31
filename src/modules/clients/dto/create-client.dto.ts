import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsLatitude,
  IsLongitude,
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

  @ApiPropertyOptional({
    description:
      'Logo del cliente. En POST/PATCH usar multipart campo `logoUrl` (archivo); se sube a S3 Customers.',
  })
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
      'Porcentaje de bonificación sobre saldo inicial (ej. 10 => 1000 financiados acreditan 1100). Mínimo 1; no se permiten valores como 0 o 0.2.',
    example: 10.5,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1, {
    message: 'discountPercentage debe ser al menos 1 (no se permiten 0 ni 0.x)',
  })
  discountPercentage?: number;

  @ApiPropertyOptional({
    description:
      'Porcentaje de comisión para el cliente (ej. 3.25). Mínimo 1; no se permiten valores como 0 o 0.2.',
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
      'Monto de crédito solicitado (financiado). Si RequiresCredit=true debe ser > 0 y ≤ CreditLine. En CustomerBalance.CreditBalance se guarda el Acreditado con bonificación.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditBalance?: number;

  @ApiPropertyOptional({
    description: 'Latitud del punto en mapa',
    example: 19.432608,
  })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitud del punto en mapa',
    example: -99.133209,
  })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Colonia / barrio', example: 'Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;
}
