import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, Min } from 'class-validator';

export class CreateSupplierPurchaseDto {
  @ApiProperty({
    example: 1000.5,
    description:
      'Monto de la compra. AmountReceived se calcula como amount + 7.3%.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    example: 1,
    description: '1 = Tiempo_aire, 2 = Servicios',
    enum: [1, 2],
  })
  @Type(() => Number)
  @IsIn([1, 2], { message: 'type debe ser 1 (Tiempo_aire) o 2 (Servicios)' })
  type!: number;
}
