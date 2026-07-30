import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { BrandImagesService } from './brand-images.service';

const MAX_UPLOAD = 10 * 1024 * 1024;

@ApiTags('brand-images')
@ApiBearerAuth()
@Controller('brand-images')
export class BrandImagesController {
  constructor(private readonly brandImagesService: BrandImagesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'image/png',
          'image/jpg',
          'image/jpeg',
          'image/webp',
          'image/svg+xml',
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Solo se permiten PNG, JPG, JPEG, WEBP o SVG',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir logo de marca a S3 (LogosMarcas)',
    description:
      'Sube la imagen a la carpeta S3 `LogosMarcas`. Retorna `{ url, key }`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.brandImagesService.uploadLogo(file);
  }
}
