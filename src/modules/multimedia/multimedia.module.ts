import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosModule } from '../productos/productos.module';
import { BrandImage } from './entities/brand-image.entity';
import { ProductImage } from './entities/product-image.entity';
import { MultimediaController } from './multimedia.controller';
import { MultimediaService } from './multimedia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrandImage, ProductImage]),
    ProductosModule,
  ],
  controllers: [MultimediaController],
  providers: [MultimediaService],
  exports: [MultimediaService],
})
export class MultimediaModule {}
