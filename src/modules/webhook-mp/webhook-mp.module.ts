import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../users/entities/user.entity';
import { WebhookMpController } from './webhook-mp.controller';
import { WebhookMpService } from './webhook-mp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Client,
      User,
      CustomerBalance,
      BalanceHistory,
    ]),
  ],
  controllers: [WebhookMpController],
  providers: [WebhookMpService],
})
export class WebhookMpModule {}
