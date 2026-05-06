import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Respuesta para GET /transactions/external/:externalId (sin netAmount). */
export class TransactionByExternalIdDto {
  @ApiProperty({ example: 1 })
  idTransaction!: number;

  @ApiPropertyOptional({
    description: '0 = Pagado (Balance), 1 = Crédito (CreditBalance)',
    enum: [0, 1],
    example: 0,
    nullable: true,
  })
  isCredit!: number | null;

  @ApiPropertyOptional({
    description: 'Mismo significado que isCredit, en texto',
    enum: ['Pagado', 'Crédito'],
    example: 'Pagado',
    nullable: true,
  })
  tipoCobro!: 'Pagado' | 'Crédito' | null;

  @ApiProperty()
  fhRegister!: Date;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ enum: ['exitosa', 'fallida', 'pendiente'] })
  recargaEstado!: 'exitosa' | 'fallida' | 'pendiente';

  @ApiProperty()
  sku!: string;

  @ApiPropertyOptional()
  logo!: string | null;

  @ApiProperty()
  fhUpdate!: Date;

  @ApiPropertyOptional()
  destination!: string | null;

  @ApiPropertyOptional()
  brand!: string | null;
}

