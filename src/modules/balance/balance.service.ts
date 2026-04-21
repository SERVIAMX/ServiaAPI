import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

interface MovivendorLoginData {
  token: string;
}

interface MovivendorLoginResponse {
  code: number;
  message?: string;
  data?: MovivendorLoginData;
}

@Injectable()
export class BalanceService {
  constructor(private readonly config: ConfigService) {}

  private cfg(key: string): string | undefined {
    const v = this.config.get<string>(key);
    return typeof v === 'string' ? v.trim() : v;
  }

  private async loginMovivendor(): Promise<string> {
    const url = this.cfg('MOVIVENDOR_LOGIN');
    const user = this.cfg('MOVIVENDOR_CHANNEL');
    const password = this.cfg('MOVIVENDOR_PASS');
    const ident = this.cfg('MOVIVENDOR_USER');
    if (!url || !user || !password || !ident) {
      throw new InternalServerErrorException(
        'Configuración Movivendor incompleta (MOVIVENDOR_LOGIN, MOVIVENDOR_CHANNEL, MOVIVENDOR_PASS, MOVIVENDOR_USER)',
      );
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          user,
          password,
          ident,
          expire_seconds: 3600,
        }),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con Movivendor (login)');
    }

    let json: MovivendorLoginResponse;
    try {
      json = (await res.json()) as MovivendorLoginResponse;
    } catch {
      throw new BadGatewayException('Respuesta inválida de Movivendor (login)');
    }

    if (!res.ok) {
      throw new BadGatewayException(
        json?.message ?? `Movivendor login HTTP ${res.status}`,
      );
    }

    if (json.code !== 0 || !json.data?.token) {
      throw new BadGatewayException(json.message ?? 'Movivendor login rechazado');
    }

    return json.data.token;
  }

  async consultarSaldoMovivendor(): Promise<{ balance: number }> {
    const url = this.cfg('MOVIVENDOR_BALANCE');
    if (!url) {
      throw new InternalServerErrorException(
        'Falta MOVIVENDOR_BALANCE en configuración',
      );
    }

    const token = await this.loginMovivendor();

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      });
    } catch {
      throw new BadGatewayException('No se pudo conectar con Movivendor (balance)');
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new BadGatewayException('Respuesta inválida de Movivendor (balance)');
    }

    if (!res.ok) {
      const msg =
        typeof json === 'object' &&
        json !== null &&
        'message' in json &&
        typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : `Movivendor balance HTTP ${res.status}`;
      throw new BadGatewayException(msg);
    }

    // Movivendor suele responder: { code, message, data: { balance } }
    const balance =
      isRecord(json) &&
      isRecord(json.data) &&
      isRecord(json.data.data) &&
      typeof json.data.data.balance === 'number'
        ? json.data.data.balance
        : isRecord(json) &&
            isRecord(json.data) &&
            typeof json.data.balance === 'number'
          ? json.data.balance
          : isRecord(json) && typeof json.balance === 'number'
            ? json.balance
            : null;

    if (balance === null) {
      throw new BadGatewayException('Respuesta inválida de Movivendor (balance)');
    }

    // Temporal: si el proveedor devuelve 0, exponer un saldo aleatorio para pruebas
    if (balance === 0) {
      return { balance: randomInt(100, 100_000) };
    }

    return { balance };
  }
}

