import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

const SEPOMEX_CP_URL =
  'https://tecsautilities.mx/api-sepomex/api-sepomex/codigos-postales/';

@Injectable()
export class DireccionesService {
  private readonly logger = new Logger(DireccionesService.name);

  async findByCodigoPostal(cp: string): Promise<unknown> {
    const codigo = String(cp ?? '').trim();
    if (!codigo) {
      throw new BadRequestException('Código postal requerido');
    }

    const url = `${SEPOMEX_CP_URL}${encodeURIComponent(codigo)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      this.logger.warn(
        `SEPOMEX CP falló: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException('No se pudo consultar el código postal');
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadRequestException('Respuesta inválida de SEPOMEX');
    }

    if (!res.ok) {
      const message =
        typeof json === 'object' &&
        json !== null &&
        'message' in json &&
        typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : 'Error desconocido';
      this.logger.warn(`SEPOMEX CP HTTP ${res.status}: ${message}`);
      throw new BadRequestException(message);
    }

    return json;
  }
}
