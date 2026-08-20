import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceHistory } from '../clients/entities/balance-history.entity';
import { ReferenceCode } from '../references-codes/entities/reference-code.entity';
import { S3Module } from '../s3/s3.module';
import { CreditPaymentsController } from './credit-payments.controller';
import { CreditPayment } from './entities/credit-payment.entity';
import { CreditPaymentsService } from './credit-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditPayment,
      BalanceHistory,
      ReferenceCode,
    ]),
    S3Module,
  ],
  controllers: [CreditPaymentsController],
  providers: [CreditPaymentsService],
  exports: [CreditPaymentsService],
})
export class CreditPaymentsModule {}
