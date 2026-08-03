import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteBrand } from '../favorites-brands/entities/favorite-brand.entity';
import { BrandImage } from '../multimedia/entities/brand-image.entity';
import { ProductImage } from '../multimedia/entities/product-image.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      BrandImage,
      ProductImage,
      FavoriteBrand,
    ]),
    forwardRef(() => TransactionsModule),
  ],
  controllers: [ProductosController],
  providers: [ProductosService],
  exports: [ProductosService],
})
export class ProductosModule {}
