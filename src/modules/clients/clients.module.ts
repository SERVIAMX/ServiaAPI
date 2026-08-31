import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Module } from '../s3/s3.module';
import { User } from '../users/entities/user.entity';
import { Client } from './entities/client.entity';
import { BalanceHistory } from './entities/balance-history.entity';
import { CustomerBalance } from './entities/customer-balance.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, User, CustomerBalance, BalanceHistory]),
    S3Module,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
