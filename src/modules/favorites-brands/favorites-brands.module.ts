import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { FavoriteBrand } from './entities/favorite-brand.entity';
import { FavoritesBrandsController } from './favorites-brands.controller';
import { FavoritesBrandsService } from './favorites-brands.service';

@Module({
  imports: [TypeOrmModule.forFeature([FavoriteBrand, Client])],
  controllers: [FavoritesBrandsController],
  providers: [FavoritesBrandsService],
  exports: [FavoritesBrandsService],
})
export class FavoritesBrandsModule {}
