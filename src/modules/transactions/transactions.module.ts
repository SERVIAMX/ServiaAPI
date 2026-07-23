import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { ProductosModule } from '../productos/productos.module';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { TransactionHistory } from './entities/transaction-history.entity';
import { Transaction } from './entities/transaction.entity';
import { TransactionGateService } from './transaction-gate.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionHistory,
      User,
      Client,
      CustomerBalance,
      Role,
    ]),
    forwardRef(() => ProductosModule),
    AuditLogModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionGateService],
  exports: [TransactionsService, TransactionGateService],
})
export class TransactionsModule {}
