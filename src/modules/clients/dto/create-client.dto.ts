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
      'Monto pagado inicial. Requerido si RequiresCredit = false. Si se envía > 0, se registra en BalanceHistory como type 1.',
    example: 200,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'Línea de crédito máxima permitida para el cliente. CreditBalance no puede ser mayor a CreditLine.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLine?: number;

  @ApiPropertyOptional({
    description:
      'Balance de crédito inicial para el cliente. Si no se envía, inicia en 0.',
    example: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditBalance?: number;
}
