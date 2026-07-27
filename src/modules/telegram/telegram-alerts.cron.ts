import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { BalanceService } from '../balance/balance.service';
import { TelegramService } from './telegram.service';

@Injectable()
export class TelegramAlertsCron implements OnModuleInit {
  private readonly logger = new Logger(TelegramAlertsCron.name);

  constructor(
    private readonly balanceService: BalanceService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Chequeo inicial de saldo Movivendor al arrancar...');
    await this.checkMovivendorBalance();
  }

  @Cron('*/2 * * * *')
  async checkMovivendorBalance(): Promise<void> {
    const thresholdRaw = this.config.get<string>(
      'TELEGRAM_BALANCE_THRESHOLD',
      '1000',
    );
    const threshold = Number(thresholdRaw);
    const limit = Number.isFinite(threshold) ? threshold : 1000;

    try {
      const { balance } = await this.balanceService.consultarSaldoMovivendor();
      this.logger.log(
        `Cron saldo Movivendor: balance=${balance} umbral=${limit}`,
      );
      if (balance < limit) {
        await this.telegramService.notifyLowBalance(balance, limit);
      }
    } catch (err) {
      this.logger.warn(
        `Cron saldo Movivendor falló: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
