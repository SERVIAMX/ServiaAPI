/**
 * Reescribe una URL de imagen externa al proxy de Servia:
 * `{publicBase}/api/image-proxy?url=...`
 */
export function toProxiedImageUrl(
  publicBaseUrl: string | undefined | null,
  originalUrl: string | null | undefined,
): string {
  const original = String(originalUrl ?? '').trim();
  if (!original) return '';

  const base = String(publicBaseUrl ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return original;

  // Ya está proxied
  if (original.includes('/api/image-proxy?')) return original;

  try {
    const u = new URL(original);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return original;
  } catch {
    return original;
  }

  return `${base}/api/image-proxy?url=${encodeURIComponent(original)}`;
}

/** Hosts permitidos para evitar SSRF vía image-proxy. */
export function isAllowedImageProxyHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;

  const movivendor =
    host === 'movivendor.com' ||
    host.endsWith('.movivendor.com') ||
    host === 'vwdev.movivendor.com';

  // Virtual-hosted / path-style S3 (ej. serviasys.s3.us-east-1.amazonaws.com)
  const s3Amazon =
    host.endsWith('.amazonaws.com') &&
    (host.includes('.s3.') ||
      host.includes('.s3-') ||
      host.startsWith('s3.') ||
      host.startsWith('s3-'));

  return movivendor || s3Amazon;
}
