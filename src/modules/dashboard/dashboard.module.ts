import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { TransactionHistory } from '../transactions/entities/transaction-history.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      BalanceHistory,
      CustomerBalance,
      TransactionHistory,
      Role,
    ]),
    AuditLogModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
