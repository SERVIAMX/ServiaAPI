import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { TelegramAlertsCron } from './telegram-alerts.cron';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [BalanceModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramAlertsCron],
  exports: [TelegramService],
})
export class TelegramModule {}
