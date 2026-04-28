import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, Min } from 'class-validator';

export class AdjustCustomerBalanceDto {
  @ApiProperty({ example: 1, description: 'Id del cliente (Clients.Id)' })
  @IsNumber()
  customerId: number;

  @ApiProperty({
    example: false,
    description:
      'Si true, el Amount suma a CreditBalance. Si false, el Amount suma a Balance.',
  })
  @IsBoolean()
  requiresCredit: boolean;

  @ApiProperty({ example: 200, description: 'Monto a sumar (2 decimales)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}

