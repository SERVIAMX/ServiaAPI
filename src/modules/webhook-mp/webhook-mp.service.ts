import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookMpService {
  private readonly logger = new Logger(WebhookMpService.name);

  recibirNotificacion(body: unknown): { received: true } {
    this.logger.log(
      `[WebhookMP] Body recibido: ${JSON.stringify(body, null, 2)}`,
    );
    return { received: true };
  }
}
