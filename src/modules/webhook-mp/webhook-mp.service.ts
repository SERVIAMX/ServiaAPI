import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { MercadoPagoWebhookDto } from './dto/mercado-pago-webhook.dto';

function isPagoAcreditado(dto: MercadoPagoWebhookDto): boolean {
  return (
    dto.status?.trim().toLowerCase() === 'processed' &&
    dto.payment_status_detail?.trim().toLowerCase() === 'accredited'
  );
}

/** `client_id` (string o número) o `external_reference` `c_3__...` → 3 */
function resolveClientId(dto: MercadoPagoWebhookDto): number {
  const raw =
    dto.client_id !== undefined && dto.client_id !== null
      ? String(dto.client_id).trim()
      : '';
  const fromField = Number(raw);
  if (raw !== '' && Number.isInteger(fromField) && fromField > 0) {
    return fromField;
  }

  const ref = dto.external_reference?.trim() ?? '';
  const match = ref.match(/^c_(\d+)__/i);
  if (match) {
    const id = Number(match[1]);
    if (Number.isInteger(id) && id > 0) return id;
  }

  throw new BadRequestException(
    'No se pudo resolver el cliente: envía client_id o external_reference con formato c_{id}__...',
  );
}

@Injectable()
export class WebhookMpService {
  private readonly logger = new Logger(WebhookMpService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CustomerBalance)
    private readonly customerBalanceRepository: Repository<CustomerBalance>,
    @InjectRepository(BalanceHistory)
    private readonly balanceHistoryRepository: Repository<BalanceHistory>,
  ) {}

  async recibirNotificacion(dto: MercadoPagoWebhookDto) {
    const clientId = resolveClientId(dto);
    const amount = Number(dto.total_amount);
    const acreditar = isPagoAcreditado(dto);

    this.logger.log(
      `[WebhookMP] payment_id=${dto.payment_id} clientId=${clientId} amount=${dto.total_amount} acreditar=${acreditar}`,
    );

    if (Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException('total_amount inválido');
    }

    const client = await this.clientRepository.findOne({
      where: { id: clientId, deletedAt: IsNull() },
    });
    if (!client) {
      throw new NotFoundException(`Cliente no encontrado (id=${clientId})`);
    }

    const existente = await this.paymentRepository.findOne({
      where: { paymentId: dto.payment_id },
      relations: { client: true },
    });

    if (existente) {
      this.logger.warn(`[WebhookMP] payment_id duplicado: ${dto.payment_id}`);
      const balanceCredited = acreditar
        ? await this.acreditarSaldoSiFalta(client, amount, existente.fhRegistro)
        : false;
      return {
        received: true,
        duplicate: true,
        paymentId: dto.payment_id,
        balanceCredited,
        clientId,
        amount: amount.toFixed(2),
      };
    }

    const user = await this.userRepository.findOne({
      where: { client: { id: clientId }, deletedAt: IsNull() },
      order: { id: 'ASC' },
    });
    const userId = user?.id ?? 0;
    if (!user) {
      this.logger.warn(
        `[WebhookMP] Sin usuario para clientId=${clientId}; Payment.UserId=0`,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const payment = this.paymentRepository.create({
        orderId: dto.order_id,
        paymentId: dto.payment_id,
        status: dto.status,
        paymentStatus: dto.payment_status,
        paymentStatusDetail: dto.payment_status_detail,
        totalAmount: amount.toFixed(2),
        externalReference: dto.external_reference ?? null,
        userId,
        client,
      });
      await qr.manager.save(payment);

      let balanceCredited = false;
      if (acreditar) {
        await this.acreditarBalanceCliente(qr.manager, client, amount);
        balanceCredited = true;
        this.logger.log(
          `[WebhookMP] Saldo acreditado: clientId=${clientId} +${amount.toFixed(2)}`,
        );
      } else {
        this.logger.log(
          `[WebhookMP] Pago guardado sin abono (status=${dto.status}, detail=${dto.payment_status_detail})`,
        );
      }

      await qr.commitTransaction();

      return {
        received: true,
        duplicate: false,
        paymentId: dto.payment_id,
        balanceCredited,
        clientId,
        amount: amount.toFixed(2),
      };
    } catch (e) {
      await qr.rollbackTransaction();
      this.logger.error(
        `[WebhookMP] Error: ${e instanceof Error ? e.message : e}`,
        e instanceof Error ? e.stack : undefined,
      );
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Evita doble abono si MP reenvía el mismo payment_id. */
  private async yaTieneAbonoRegistrado(
    clientId: number,
    amountStr: string,
    desde: Date,
  ): Promise<boolean> {
    const count = await this.balanceHistoryRepository
      .createQueryBuilder('bh')
      .where('bh.CustomerId = :cid', { cid: clientId })
      .andWhere('bh.amount = :amt', { amt: amountStr })
      .andWhere('bh.isPaid = 1')
      .andWhere('bh.transactionType = 1')
      .andWhere('bh.fhRegistro >= :desde', { desde })
      .getCount();
    return count > 0;
  }

  private async acreditarSaldoSiFalta(
    client: Client,
    amount: number,
    desde: Date,
  ): Promise<boolean> {
    const amountStr = amount.toFixed(2);
    if (await this.yaTieneAbonoRegistrado(client.id, amountStr, desde)) {
      this.logger.log(
        `[WebhookMP] Abono ya existía para clientId=${client.id} amount=${amountStr}`,
      );
      return false;
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await this.acreditarBalanceCliente(qr.manager, client, amount);
      await qr.commitTransaction();
      this.logger.log(
        `[WebhookMP] Saldo acreditado (reintento): clientId=${client.id} +${amountStr}`,
      );
      return true;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  private async acreditarBalanceCliente(
    manager: EntityManager,
    client: Client,
    amount: number,
  ): Promise<void> {
    let cb = await manager.findOne(CustomerBalance, {
      where: { customer: { id: client.id } },
      relations: { customer: true },
    });

    if (!cb) {
      cb = manager.create(CustomerBalance, {
        customer: client,
        creditBalance: '0.00',
        balance: '0.00',
      });
    }

    const currentBalance = Number(cb.balance ?? 0) || 0;
    cb.balance = (currentBalance + amount).toFixed(2);
    await manager.save(cb);

    const hist = manager.create(BalanceHistory, {
      customer: client,
      amount: amount.toFixed(2),
      transactionType: 1,
      isPaid: 1,
    });
    await manager.save(hist);
  }
}
