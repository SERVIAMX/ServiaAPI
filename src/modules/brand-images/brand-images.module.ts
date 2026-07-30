import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { BrandImagesController } from './brand-images.controller';
import { BrandImagesService } from './brand-images.service';

@Module({
  imports: [S3Module],
  controllers: [BrandImagesController],
  providers: [BrandImagesService],
  exports: [BrandImagesService],
})
export class BrandImagesModule {}
