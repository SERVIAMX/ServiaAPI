import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterBalanceHistoryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Fecha inicio (ISO). Ej: 2026-04-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaInicio?: Date;

  @ApiPropertyOptional({
    description: 'Fecha fin (ISO). Ej: 2026-04-30T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaFin?: Date;
}

