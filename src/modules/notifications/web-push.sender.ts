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
  private readonly vapidSubject: string;
  private readonly vapidPublicKey: string | null;
  private readonly vapidPrivateKey: string | null;

  constructor(config: ConfigService) {
    const publica = config.get<string>('VAPID_PUBLIC_KEY')?.trim() || null;
    const privada = config.get<string>('VAPID_PRIVATE_KEY')?.trim() || null;
    // Apple (web.push.apple.com) valida el `sub` del JWT con más rigor que FCM:
    // debe ser mailto: o https: con dominio real (no .local / inventado).
    const sujeto =
      config.get<string>('VAPID_SUBJECT')?.trim() ||
      'mailto:serviasysmx@gmail.com';

    this.publicKey = publica;
    this.vapidPublicKey = publica;
    this.vapidPrivateKey = privada;
    this.vapidSubject = sujeto;
    this.disponible = Boolean(publica && privada);

    if (this.disponible) {
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
        {
          TTL: 60 * 60,
          urgency: 'normal',
          vapidDetails: {
            subject: this.vapidSubject,
            publicKey: this.vapidPublicKey as string,
            privateKey: this.vapidPrivateKey as string,
          },
        },
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
      const appleHint =
        host.includes('apple.com') && detail.includes('BadJwtToken')
          ? ' En iOS/Apple: VAPID_SUBJECT debe ser mailto: o https: con dominio real; ' +
            'reinicia API y reintenta. Si sigue, la PWA iOS se suscribió con otra publicKey.'
          : ' Causa habitual: la PWA se suscribió con otra VAPID_PUBLIC_KEY; ' +
            'usar GET /notifications/status y volver a POST /subscription.';
      this.log.warn(
        `Push no entregado (${status ?? 'sin código'}) host=${host}: ${detail}.${appleHint}`,
      );
      return { ok: false, expired: false };
    }
  }
}
