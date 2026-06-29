/** Movivendor no respondió a tiempo o devolvió HTML/5xx (estado incierto en venta). */
export class MovivendorTimeoutException extends Error {
  readonly name = 'MovivendorTimeoutException';

  constructor(
    public readonly operation: string,
    public readonly httpStatus?: number,
    public readonly detail?: string,
  ) {
    super(
      `Movivendor timeout (${operation})${httpStatus ? ` HTTP ${httpStatus}` : ''}`,
    );
  }
}

export function isMovivendorGatewayTimeoutStatus(status: number): boolean {
  return status === 408 || status === 502 || status === 503 || status === 504;
}

export function looksLikeMovivendorGatewayTimeout(
  httpStatus: number | undefined,
  rawText: string,
): boolean {
  if (httpStatus !== undefined && isMovivendorGatewayTimeoutStatus(httpStatus)) {
    return true;
  }
  const raw = rawText.trim().toLowerCase();
  return (
    raw.startsWith('<html') ||
    raw.includes('gateway time-out') ||
    raw.includes('gateway timeout')
  );
}
