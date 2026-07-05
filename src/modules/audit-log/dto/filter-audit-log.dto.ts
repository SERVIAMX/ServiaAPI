import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AUDIT_OPERATION, AUDIT_STATUS } from '../audit-log.types';

export class FilterAuditLogDto extends PaginationDto {
  @ApiPropertyOptional({ example: 14, description: 'Filtrar por Id de cliente' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional({
    enum: Object.values(AUDIT_OPERATION),
    example: AUDIT_OPERATION.TRANSACTION_CREATE,
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(AUDIT_OPERATION))
  operationType?: string;

  @ApiPropertyOptional({
    enum: Object.values(AUDIT_STATUS),
    example: AUDIT_STATUS.SUCCESS,
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(AUDIT_STATUS))
  status?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Fecha inicio (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'Fecha fin (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;
}
