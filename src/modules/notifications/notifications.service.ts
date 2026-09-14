import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { SubscribePushDto } from './dto/push-subscription.dto';
import { PushSubscription } from './entities/push-subscription.entity';
import { WebPushSender } from './web-push.sender';

export const DEFAULT_LOW_BALANCE_THRESHOLD = 150;

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly lowBalanceThreshold: number;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushRepo: Repository<PushSubscription>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepo: Repository<CustomerBalance>,
    private readonly sender: WebPushSender,
    config: ConfigService,
  ) {
    const raw = Number(config.get<string>('LOW_BALANCE_THRESHOLD'));
    this.lowBalanceThreshold =
      Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LOW_BALANCE_THRESHOLD;
  }

  status() {
    return {
      disponible: this.sender.disponible,
      publicKey: this.sender.publicKey,
      lowBalanceThreshold: this.lowBalanceThreshold,
    };
  }

  async subscribe(
    userId: number,
    clientId: number,
    dto: SubscribePushDto,
  ): Promise<void> {
    const existing = await this.pushRepo.findOne({
      where: { endpoint: dto.endpoint },
    });

    const timeZone = dto.timeZone?.trim() || 'America/Mexico_City';

    if (existing) {
      existing.userId = userId;
      existing.clientId = clientId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      existing.timeZone = timeZone;
      await this.pushRepo.save(existing);
      this.log.log(
        `Suscripción push actualizada userId=${userId} clientId=${clientId}`,
      );
      return;
    }

    await this.pushRepo.save(
      this.pushRepo.create({
        userId,
        clientId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        timeZone,
        lastSentAt: null,
      }),
    );
    this.log.log(
      `Suscripción push creada userId=${userId} clientId=${clientId}`,
    );
  }

  async unsubscribe(userId: number, endpoint: string): Promise<void> {
    await this.pushRepo.delete({ userId, endpoint });
  }

  async test(userId: number): Promise<{ enviados: number }> {
    const subs = await this.pushRepo.find({ where: { userId } });
    let enviados = 0;

    for (const sub of subs) {
      const result = await this.sender.send(sub, {
        title: 'Servia',
        body: 'Así se verán tus avisos de saldo.',
        tag: 'servia-test',
        url: '/',
        data: { type: 'test' },
      });
      if (result.ok) {
        enviados++;
        sub.lastSentAt = new Date();
        await this.pushRepo.save(sub);
      }
      if (result.expired) {
        await this.pushRepo.delete({ endpoint: sub.endpoint });
      }
    }

    return { enviados };
  }

  /**
   * Si Balance o CreditBalance del cliente quedan por debajo del umbral,
   * envía push a todos los dispositivos suscritos de ese cliente.
   * No bloquea la venta: fallos se registran y se ignoran.
   */
  async notifyLowBalanceIfNeeded(clientId: number): Promise<void> {
    if (!this.sender.disponible) return;

    try {
      const row = await this.customerBalanceRepo.findOne({
        where: { customer: { id: clientId } },
      });

      if (!row) return;

      const balance = Number(row.balance);
      const creditBalance = Number(row.creditBalance);
      const bal = Number.isFinite(balance) ? balance : 0;
      const credit = Number.isFinite(creditBalance) ? creditBalance : 0;

      if (
        bal >= this.lowBalanceThreshold &&
        credit >= this.lowBalanceThreshold
      ) {
        return;
      }

      const subs = await this.pushRepo.find({ where: { clientId } });
      if (!subs.length) return;

      const parts: string[] = [];
      if (bal < this.lowBalanceThreshold) {
        parts.push(`saldo $${bal.toFixed(2)}`);
      }
      if (credit < this.lowBalanceThreshold) {
        parts.push(`crédito $${credit.toFixed(2)}`);
      }

      const body = `Tu saldo se está agotando (${parts.join(', ')}). Umbral: $${this.lowBalanceThreshold.toFixed(0)}.`;

      for (const sub of subs) {
        const result = await this.sender.send(sub, {
          title: 'Saldo bajo — Servia',
          body,
          tag: 'low-balance',
          url: '/',
          data: {
            type: 'low_balance',
            balance: bal,
            creditBalance: credit,
            threshold: this.lowBalanceThreshold,
            clientId,
          },
        });
        if (result.ok) {
          sub.lastSentAt = new Date();
          await this.pushRepo.save(sub);
        }
        if (result.expired) {
          await this.pushRepo.delete({ endpoint: sub.endpoint });
        }
      }

      this.log.log(
        `Aviso saldo bajo enviado clientId=${clientId} dispositivos=${subs.length} balance=${bal} credit=${credit}`,
      );
    } catch (error) {
      this.log.warn(
        `No se pudo notificar saldo bajo clientId=${clientId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
