/**
 * Saldo a sumar en `CustomerBalance.Balance`:
 * monto recibido + `DiscountPercentage` como bonificación (ej. 100 + 10% => 110).
 */
export function calcularSaldoAcreditadoConBonificacion(
  amount: number,
  discountPercentage: string | number | null | undefined,
): number {
  const pct = Number(discountPercentage ?? '0');
  const bonus = Number.isFinite(pct) ? pct : 0;
  return Number((amount * (1 + bonus / 100)).toFixed(2));
}
