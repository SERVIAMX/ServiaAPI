import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterTransactionsDto extends PaginationDto {
  @ApiProperty({
    description: 'Inicio del rango (FHRegister). Formato YYYY-MM-DD o ISO 8601',
    example: '2026-05-01',
  })
  @IsDateString()
  @MaxLength(32)
  from!: string;

  @ApiProperty({
    description: 'Fin del rango (FHRegister). Formato YYYY-MM-DD o ISO 8601',
    example: '2026-05-31',
  })
  @IsDateString()
  @MaxLength(32)
  to!: string;
}
