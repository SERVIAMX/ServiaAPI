import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface PushDestination {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  ok: boolean;
  expired: boolean;
}

/**
 * Web Push (VAPID) para PWA Flutter/web.
 * Sin claves el API arranca; `disponible` queda en false.
 */
@Injectable()
export class WebPushSender {
  private readonly log = new Logger(WebPushSender.name);
  readonly publicKey: string | null;
  readonly disponible: boolean;

  constructor(config: ConfigService) {
    const publica = config.get<string>('VAPID_PUBLIC_KEY')?.trim() || null;
    const privada = config.get<string>('VAPID_PRIVATE_KEY')?.trim() || null;
    const sujeto =
      config.get<string>('VAPID_SUBJECT')?.trim() ||
      'mailto:soporte@servia.com';

    this.publicKey = publica;
    this.disponible = Boolean(publica && privada);

    if (this.disponible) {
      // FCM/Chrome rechazan subject inválido (.local, http://localhost, etc.)
      webpush.setVapidDetails(sujeto, publica as string, privada as string);
      this.log.log(`Web Push VAPID activo (subject=${sujeto})`);
    } else {
      this.log.warn(
        'Sin VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY: push a clientes desactivado.',
      );
    }
  }

  /**
   * Payload pensado para Service Worker de Flutter PWA:
   * title/body/tag/data en la raíz (fácil de parsear en `push` event).
   */
  async send(
    destino: PushDestination,
    message: PushMessage,
  ): Promise<PushSendResult> {
    if (!this.disponible) return { ok: false, expired: false };

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      tag: message.tag ?? 'servia',
      data: {
        url: message.url ?? '/',
        ...(message.data ?? {}),
      },
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: destino.endpoint,
          keys: { p256dh: destino.p256dh, auth: destino.auth },
        },
        payload,
        { TTL: 60 * 60 },
      );
      return { ok: true, expired: false };
    } catch (error) {
      const err = error as {
        statusCode?: number;
        body?: string;
        endpoint?: string;
        message?: string;
      };
      const status = err.statusCode;
      if (status === 404 || status === 410) {
        return { ok: false, expired: true };
      }
      const host = (() => {
        try {
          return err.endpoint ? new URL(err.endpoint).host : 'unknown';
        } catch {
          return 'unknown';
        }
      })();
      const detail = (err.body || err.message || '').toString().trim();
      this.log.warn(
        `Push no entregado (${status ?? 'sin código'}) host=${host}: ${detail}. ` +
          'Causa habitual: la PWA se suscribió con otra VAPID_PUBLIC_KEY; ' +
          'usar GET /notifications/status y volver a POST /subscription.',
      );
      return { ok: false, expired: false };
    }
  }
}
