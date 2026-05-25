import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerBalance, Client, BalanceHistory, Role]),
  ],
  controllers: [BalanceController],
  providers: [BalanceService],
})
export class BalanceModule {}

