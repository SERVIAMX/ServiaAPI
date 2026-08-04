import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/entities/role.entity';
import { SupplierPurchase } from './entities/supplier-purchase.entity';
import { SupplierPurchasesController } from './supplier-purchases.controller';
import { SupplierPurchasesService } from './supplier-purchases.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierPurchase, Role])],
  controllers: [SupplierPurchasesController],
  providers: [SupplierPurchasesService],
  exports: [SupplierPurchasesService],
})
export class SupplierPurchasesModule {}
