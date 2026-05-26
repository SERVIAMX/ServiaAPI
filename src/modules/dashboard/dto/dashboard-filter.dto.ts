import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, ValidateIf } from 'class-validator';

/** `""`, `null` o solo espacios → sin fecha (usa día actual en el servicio). */
function fechaOpcional({ value }: { value: unknown }): Date | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const s = value.trim();
    if (s === '') return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    return new Date(s);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // `yyyy-MM-dd` vía JSON → medianoche UTC; normalizar a calendario local
    if (/T00:00:00\.000Z$/.test(value.toISOString())) {
      return new Date(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
        0,
        0,
        0,
        0,
      );
    }
    return value;
  }
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
