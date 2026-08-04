import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterSupplierPurchasesDto extends PaginationDto {
  @ApiProperty({
    description: 'Inicio del rango (FHRegistro). Formato YYYY-MM-DD o ISO 8601',
    example: '2026-08-01',
  })
  @IsDateString()
  @MaxLength(32)
  from!: string;

  @ApiProperty({
    description: 'Fin del rango (FHRegistro). Formato YYYY-MM-DD o ISO 8601',
    example: '2026-08-31',
  })
  @IsDateString()
  @MaxLength(32)
  to!: string;
}
