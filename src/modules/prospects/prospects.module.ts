import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '../clients/clients.module';
import { Client } from '../clients/entities/client.entity';
import { S3Module } from '../s3/s3.module';
import { Prospect } from './entities/prospect.entity';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prospect, Client]),
    S3Module,
    ClientsModule,
  ],  controllers: [ProspectsController],
  providers: [ProspectsService],
  exports: [ProspectsService],
})
export class ProspectsModule {}
