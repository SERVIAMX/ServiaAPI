import { ApiProperty } from '@nestjs/swagger';

export class RequestSelfCreditResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indica si la solicitud de crédito se procesó correctamente',
  })
  success!: boolean;

  @ApiProperty({
    example: 'Saldo asignado correctamente',
    description:
      'Mensaje de resultado. En error de negocio describe la causa (crédito pendiente, límite excedido, etc.)',
  })
  message!: string;
}
