import { SetMetadata } from '@nestjs/common';

export const SKIP_RESPONSE_INTERCEPTOR_KEY = 'skipResponseInterceptor';

/** Respuesta cruda (p. ej. descarga de archivo) sin envoltorio estándar. */
export const SkipResponseInterceptor = () =>
  SetMetadata(SKIP_RESPONSE_INTERCEPTOR_KEY, true);
