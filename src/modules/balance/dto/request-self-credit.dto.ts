import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class RequestSelfCreditDto {
  @ApiProperty({
    example: 900,
    description:
      'Monto solicitado (se valida contra CreditLine). El SPEI debe cobrarse por este monto; en CreditBalance se acredita el valor con bonificación (`Acreditado`).',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}
