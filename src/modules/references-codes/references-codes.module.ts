import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { ReferenceCode } from './entities/reference-code.entity';
import { ReferencesCodesController } from './references-codes.controller';
import { ReferencesCodesService } from './references-codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceCode, Client])],
  controllers: [ReferencesCodesController],
  providers: [ReferencesCodesService],
  exports: [ReferencesCodesService],
})
export class ReferencesCodesModule {}
