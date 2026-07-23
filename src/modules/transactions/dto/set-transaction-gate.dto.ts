import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetTransactionGateDto {
  @ApiProperty({
    example: true,
    description:
      'Si true, el API rechaza nuevas ventas (`POST /transactions`) hasta poner false.',
  })
  @IsBoolean()
  paused!: boolean;
}
