import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { SubscribePushDto } from './dto/push-subscription.dto';
import {
  AdminPushTestType,
} from './dto/test-admin-push.dto';
import { PushSubscription } from './entities/push-subscription.entity';
import { WebPushSender } from './web-push.sender';

export const DEFAULT_LOW_BALANCE_THRESHOLD = 150;

const ADMIN_ROLE_NAMES = new Set([
  'super administrador',
  'administrador',
]);

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly lowBalanceThreshold: number;
  private readonly config: ConfigService;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushRepo: Repository<PushSubscription>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepo: Repository<CustomerBalance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly sender: WebPushSender,
    config: ConfigService,
  ) {
    this.config = config;
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
        title: '📲 ¡No te quedes sin saldo!',
        body: 'Recarga tu cuenta y continúa realizando recargas y generando ganancias. 🚀',
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
   * Push solo a usuarios con rol Super Administrador / Administrador (o RoleId=1)
   * que tengan dispositivos suscritos. No lanza.
   */
  async notifyAdmins(params: {
    title: string;
    body: string;
    tag: string;
    data?: Record<string, unknown>;
    url?: string;
  }): Promise<{ enviados: number }> {
    if (!this.sender.disponible) return { enviados: 0 };

    try {
      const admins = await this.userRepo
        .createQueryBuilder('u')
        .innerJoinAndSelect('u.role', 'r')
        .where('u.isActive = :active', { active: 1 })
        .andWhere('u.deletedAt IS NULL')
        .getMany();

      const adminIds = admins
        .filter((u) => {
          const nameNorm = u.role?.name?.trim().toLowerCase() ?? '';
          return ADMIN_ROLE_NAMES.has(nameNorm) || u.role?.id === 1;
        })
        .map((u) => u.id);

      if (!adminIds.length) return { enviados: 0 };

      const subs = await this.pushRepo.find({
        where: { userId: In(adminIds) },
      });
      if (!subs.length) {
        this.log.debug(
          `notifyAdmins: sin suscripciones push (admins=${adminIds.length})`,
        );
        return { enviados: 0 };
      }

      let enviados = 0;
      for (const sub of subs) {
        const result = await this.sender.send(sub, {
          title: params.title,
          body: params.body,
          tag: params.tag,
          url: params.url ?? '/',
          data: {
            audience: 'admin',
            ...(params.data ?? {}),
          },
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

      this.log.log(
        `Push admin enviado tag=${params.tag} dispositivos=${subs.length} ok=${enviados}`,
      );
      return { enviados };
    } catch (error) {
      this.log.warn(
        `notifyAdmins falló: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return { enviados: 0 };
    }
  }

  async notifyAdminsTransactionError(alert: {
    idTransaction: number;
    externalId: string;
    code: string;
    message: string | null;
    destination: string;
    amount: string | number;
    clientName: string;
  }): Promise<void> {
    const detail = alert.message?.trim()
      ? ` · ${alert.message.trim()}`
      : '';
    await this.notifyAdmins({
      title: '⚠️ Transacción rechazada',
      body: `Tx #${alert.idTransaction} · ${alert.clientName} · ${alert.destination} · $${alert.amount} · Code ${alert.code}${detail}`,
      tag: 'admin-tx-error',
      data: {
        type: 'admin_transaction_error',
        ...alert,
      },
    });
  }

  async notifyAdminsMovivendorLowBalance(
    balance: number,
    threshold: number,
  ): Promise<void> {
    await this.notifyAdmins({
      title: '💰 Saldo Movivendor bajo',
      body: `Balance: $${balance.toFixed(2)} (umbral: $${threshold})`,
      tag: 'admin-movivendor-low',
      data: {
        type: 'admin_movivendor_low_balance',
        balance,
        threshold,
      },
    });
  }

  async assertPrivilegedAdmin(roleId: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new ForbiddenException('Sin rol asignado');
    const nameNorm = role.name?.trim().toLowerCase() ?? '';
    if (!ADMIN_ROLE_NAMES.has(nameNorm) && role.id !== 1) {
      throw new ForbiddenException(
        'Solo Super Administrador o Administrador pueden usar este recurso',
      );
    }
  }

  /**
   * Simulacro de push admin (tx rechazada / saldo Movivendor).
   * Solo admins; envía a todos los dispositivos admin suscritos.
   */
  async testAdmin(
    roleId: number,
    tipo: AdminPushTestType = 'all',
  ): Promise<{
    enviados: number;
    tipos: string[];
  }> {
    await this.assertPrivilegedAdmin(roleId);

    const tipos: string[] = [];
    let enviados = 0;

    if (tipo === 'transaction_error' || tipo === 'all') {
      const r = await this.notifyAdmins({
        title: '⚠️ Transacción rechazada',
        body: 'Tx #99999 · Cliente Demo · 5512345678 · $50 · Code 99 · Simulacro admin',
        tag: 'admin-tx-error',
        data: {
          type: 'admin_transaction_error',
          simulacro: true,
          idTransaction: 99999,
          externalId: 'SIM-TEST-ADMIN',
          code: '99',
          message: 'Simulacro admin',
          destination: '5512345678',
          amount: '50',
          clientName: 'Cliente Demo',
        },
      });
      enviados += r.enviados;
      tipos.push('transaction_error');
    }

    if (tipo === 'movivendor_low' || tipo === 'all') {
      const thresholdRaw = Number(
        this.config.get<string>('TELEGRAM_BALANCE_THRESHOLD', '1000'),
      );
      const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 1000;
      const r = await this.notifyAdmins({
        title: '💰 Saldo Movivendor bajo',
        body: `Balance: $0.00 (umbral: $${threshold}) · Simulacro admin`,
        tag: 'admin-movivendor-low',
        data: {
          type: 'admin_movivendor_low_balance',
          simulacro: true,
          balance: 0,
          threshold,
        },
      });
      enviados += r.enviados;
      tipos.push('movivendor_low');
    }

    return { enviados, tipos };
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

      for (const sub of subs) {
        const result = await this.sender.send(sub, {
          title: '📲 ¡No te quedes sin saldo!',
          body: 'Recarga tu cuenta y continúa realizando recargas y generando ganancias. 🚀',
          tag: 'low-balance',
          url: '/',
          data: {
            type: 'low_balance',
            balance: bal,
            creditBalance: credit,
            threshold: this.lowBalanceThreshold,
            clientId,
            lowParts: parts,
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
