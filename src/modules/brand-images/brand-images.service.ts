import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';

const S3_FOLDER = 'LogosMarcas';

@Injectable()
export class BrandImagesService {
  constructor(private readonly s3Service: S3Service) {}

  async uploadLogo(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('El archivo es obligatorio');
    }
    return this.s3Service.uploadFile(file, S3_FOLDER);
  }
}
