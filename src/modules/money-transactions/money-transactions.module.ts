import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/entities/role.entity';
import { S3Module } from '../s3/s3.module';
import { Bank } from './entities/bank.entity';
import { MoneyTransaction } from './entities/money-transaction.entity';
import { MoneyTransactionsController } from './money-transactions.controller';
import { MoneyTransactionsService } from './money-transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MoneyTransaction, Bank, Role]),
    S3Module,
  ],
  controllers: [MoneyTransactionsController],
  providers: [MoneyTransactionsService],
  exports: [MoneyTransactionsService],
})
export class MoneyTransactionsModule {}
