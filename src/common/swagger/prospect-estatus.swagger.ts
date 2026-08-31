import { ProspectEstatus } from '../enums/prospect-estatus.enum';

export const PROSPECT_ESTATUS_DESCRIPTION = [
  'Estatus del prospecto en el pipeline comercial:',
  '- `1` **NUEVO** — Recién registrado',
  '- `2` **EN_SEGUIMIENTO** — En contacto / negociación',
  '- `3` **CONVERTIDO** — Pasó a cliente (solo vía convert-to-client)',
  '- `4` **DESCARTADO** — Rechazado o eliminado',
].join('\n');

/** Opciones para `@ApiProperty` / `@ApiPropertyOptional`. */
export const prospectEstatusApiProperty = {
  enum: ProspectEstatus,
  enumName: 'ProspectEstatus',
  description: PROSPECT_ESTATUS_DESCRIPTION,
} as const;

/** Campo `estatus` en schemas multipart/form-data de Swagger. */
export const prospectEstatusFormFieldSchema = {
  type: 'integer' as const,
  enum: [
    ProspectEstatus.NUEVO,
    ProspectEstatus.EN_SEGUIMIENTO,
    ProspectEstatus.CONVERTIDO,
    ProspectEstatus.DESCARTADO,
  ],
  example: ProspectEstatus.NUEVO,
  description: PROSPECT_ESTATUS_DESCRIPTION,
};
