import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, MaxLength } from 'class-validator';

/** Filtro de bitácora: solo rango de fechas (sin paginación ni otros filtros). */
export class FilterAuditLogDto {
  @ApiProperty({
    description: 'Inicio del rango (FHRegister). Formato YYYY-MM-DD o ISO 8601',
    example: '2026-07-01',
  })
  @IsDateString()
  @MaxLength(32)
  from!: string;

  @ApiProperty({
    description: 'Fin del rango (FHRegister). Formato YYYY-MM-DD o ISO 8601',
    example: '2026-07-18',
  })
  @IsDateString()
  @MaxLength(32)
  to!: string;
}
