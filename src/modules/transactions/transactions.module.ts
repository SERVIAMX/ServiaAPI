import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { ProductosModule } from '../productos/productos.module';
import { User } from '../users/entities/user.entity';
import { Transaction } from './entities/transaction.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, User, Client, CustomerBalance]),
    ProductosModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}

