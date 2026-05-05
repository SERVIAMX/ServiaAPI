import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class ProductosModule {}
