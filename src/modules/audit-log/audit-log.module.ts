import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditLogService } from './audit-log.service';
import { BitacoraGateway } from './bitacora.gateway';
import { OperationAuditLog } from './entities/operation-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OperationAuditLog]), AuthModule],
  providers: [AuditLogService, BitacoraGateway],
  exports: [AuditLogService, BitacoraGateway],
})
export class AuditLogModule {}
