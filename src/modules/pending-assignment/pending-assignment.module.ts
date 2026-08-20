import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceModule } from '../balance/balance.module';
import { Client } from '../clients/entities/client.entity';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { Role } from '../roles/entities/role.entity';
import { S3Module } from '../s3/s3.module';
import { PendingAssignment } from './entities/pending-assignment.entity';
import { ReferenceCode } from '../references-codes/entities/reference-code.entity';
import { PendingAssignmentController } from './pending-assignment.controller';
import { PendingAssignmentService } from './pending-assignment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PendingAssignment,
      CustomerBalance,
      Client,
      Role,
      ReferenceCode,
    ]),
    S3Module,
    BalanceModule,
  ],
  controllers: [PendingAssignmentController],
  providers: [PendingAssignmentService],
  exports: [PendingAssignmentService],
})
export class PendingAssignmentModule {}
