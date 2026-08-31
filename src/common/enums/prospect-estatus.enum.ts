/** Estatus del prospecto en el pipeline comercial. */
export enum ProspectEstatus {
  /** Recién registrado, sin seguimiento activo. */
  NUEVO = 1,
  /** En contacto / negociación. */
  EN_SEGUIMIENTO = 2,
  /** Convertido a cliente. */
  CONVERTIDO = 3,
  /** Descartado o rechazado. */
  DESCARTADO = 4,
}

export const PROSPECT_ESTATUS_VALUES = Object.values(ProspectEstatus).filter(
  (v): v is ProspectEstatus => typeof v === 'number',
);

export function isProspectEstatus(value: number): value is ProspectEstatus {
  return PROSPECT_ESTATUS_VALUES.includes(value as ProspectEstatus);
}
