import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Tipo de transacción (ej. tiempo_aire)',
    example: 'tiempo_aire',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty({ example: 'GFREEDOM' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  product!: string;

  @ApiProperty({ example: '0' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  subprod!: string;

  @ApiProperty({ example: '1234567891' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  destination!: string;

  @ApiProperty({ example: '30' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : String(value)))
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional({
    description: 'URL/Path del logo del producto para guardar en Transactions',
    example: 'https://cdn.example.com/logo.png',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string;

  @ApiPropertyOptional({
    description: 'Marca (ej. Telcel) para guardar en Transactions',
    example: 'Telcel',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(90)
  brand?: string;
}

