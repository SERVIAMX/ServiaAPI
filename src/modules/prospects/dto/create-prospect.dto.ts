import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  PROSPECT_ESTATUS_VALUES,
  ProspectEstatus,
} from '../../../common/enums/prospect-estatus.enum';
import { prospectEstatusApiProperty } from '../../../common/swagger/prospect-estatus.swagger';

export class CreateProspectDto {
  @ApiProperty({ description: 'Obligatorio. Razón social o nombre del negocio.' })
  @IsString()
  @MaxLength(200)
  businessName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @ApiPropertyOptional({ description: 'RFC mexicano' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i, {
    message: 'RFC con formato mexicano inválido',
  })
  rfc?: string;

  @ApiProperty({ description: 'Obligatorio. Correo electrónico.' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ default: 'México' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description:
      'Logo del prospecto. En POST/PATCH usar multipart campo `logoUrl` (archivo, cualquier formato, máx. 20 MB); se sube a S3 Prospects.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    ...prospectEstatusApiProperty,
    default: ProspectEstatus.NUEVO,
  })
  @IsOptional()
  @IsInt()
  @IsIn(PROSPECT_ESTATUS_VALUES)
  estatus?: ProspectEstatus;

  @ApiPropertyOptional({
    description: 'Latitud del punto en mapa',
    example: 19.432608,
  })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitud del punto en mapa',
    example: -99.133209,
  })
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Colonia / barrio', example: 'Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;
}
