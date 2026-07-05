import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { OperationAuditLog } from './entities/operation-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OperationAuditLog])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
