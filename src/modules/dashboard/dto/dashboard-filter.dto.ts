import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, ValidateIf } from 'class-validator';

/** `""`, `null` o solo espacios → sin fecha (usa día actual en el servicio). */
function fechaOpcional({ value }: { value: unknown }): Date | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value as Date;
}

export class DashboardFilterDto {
  @ApiPropertyOptional({
    description:
      'Inicio del periodo (ISO o `yyyy-MM-dd`). Omitir, enviar `{}` o dejar `""` → **día actual** (México).',
    example: '2026-05-18',
  })
  @Transform(fechaOpcional)
  @Type(() => Date)
  @IsOptional()
  @ValidateIf((o) => o.fechaFin != null)
  @IsDate()
  fechaInicio?: Date;

  @ApiPropertyOptional({
    description:
      'Fin del periodo (ISO o `yyyy-MM-dd`). Omitir, enviar `{}` o dejar `""` → **día actual** (México).',
    example: '2026-05-18',
  })
  @Transform(fechaOpcional)
  @Type(() => Date)
  @IsOptional()
  @ValidateIf((o) => o.fechaInicio != null)
  @IsDate()
  fechaFin?: Date;
}
