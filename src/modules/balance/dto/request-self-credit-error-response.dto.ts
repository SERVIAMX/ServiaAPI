import { ApiProperty } from '@nestjs/swagger';

/** Respuesta de error estándar del `GlobalExceptionFilter`. */
export class RequestSelfCreditErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    example: 'El monto solicitado excede la línea de crédito disponible',
  })
  message!: string;

  @ApiProperty({ example: null, nullable: true })
  data!: unknown;

  @ApiProperty({ example: '2026-07-16T17:00:00.000Z' })
  timestamp!: string;
}
