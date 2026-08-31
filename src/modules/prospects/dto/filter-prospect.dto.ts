import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  PROSPECT_ESTATUS_VALUES,
  ProspectEstatus,
} from '../../../common/enums/prospect-estatus.enum';
import { prospectEstatusApiProperty } from '../../../common/swagger/prospect-estatus.swagger';

export class FilterProspectDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Busca en businessName, tradeName, email, rfc',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional(prospectEstatusApiProperty)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(PROSPECT_ESTATUS_VALUES)
  estatus?: ProspectEstatus;
}
