import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TransactionErrorAlert = {
  idTransaction: number;
  externalId: string;
  code: string;
  message: string | null;
  destination: string;
  amount: string | number;
  clientName: string;
};

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  private isEnabled(): boolean {
    const enabled = this.config.get<string>('TELEGRAM_ENABLED', 'false');
    if (enabled.trim().toLowerCase() !== 'true') return false;
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN', '')?.trim();
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '')?.trim();
    return Boolean(token && chatId);
  }

  /**
   * Envía texto al chat configurado.
   * Para alertas internas no lanza; el resultado se puede inspeccionar.
   */
  async sendMessage(
    text: string,
  ): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
    if (!this.isEnabled()) {
      this.logger.debug('Telegram deshabilitado o sin token/chatId; skip send');
      return {
        ok: false,
        skipped: true,
        reason:
          'Telegram deshabilitado o faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID',
      };
    }

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')!.trim();
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID')!.trim();
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(
          `Telegram sendMessage HTTP ${res.status}: ${body.slice(0, 300)}`,
        );
        return {
          ok: false,
          reason: `Telegram HTTP ${res.status}: ${body.slice(0, 300)}`,
        };
      }
      return { ok: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Telegram sendMessage falló: ${reason}`);
      return { ok: false, reason };
    }
  }

  /** Prueba desde Swagger: misma lógica de envío con resultado explícito. */
  async sendTestMessage(text: string) {
    const result = await this.sendMessage(text);
    return {
      ...result,
      message: text,
    };
  }

  async notifyTransactionError(alert: TransactionErrorAlert): Promise<void> {
    const msg =
      `⚠️ Transacción rechazada por proveedor\n` +
      `Tx: #${alert.idTransaction} · Ext: ${alert.externalId}\n` +
      `Code: ${alert.code}` +
      (alert.message ? ` · Msg: ${alert.message}` : '') +
      `\nDestino: ${alert.destination} · Monto: ${alert.amount}\n` +
      `Cliente: ${alert.clientName}`;
    await this.sendMessage(msg);
  }

  async notifyLowBalance(balance: number, threshold: number): Promise<void> {
    const msg =
      `💰 Saldo Movivendor bajo\n` +
      `Balance: ${balance.toFixed(2)} (umbral: ${threshold})`;
    await this.sendMessage(msg);
  }
}
