import {
  BadRequestException,
  Body,
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
import { S3_FOLDERS, UploadS3Dto } from './dto/upload-s3.dto';
import { S3Service } from './s3.service';

const MAX_UPLOAD = 10 * 1024 * 1024;

@ApiTags('s3')
@ApiBearerAuth()
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

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
          'application/pdf',
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Solo se permiten PNG, JPG, JPEG, WEBP, SVG o PDF',
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
    summary: 'Subir archivo a S3',
    description:
      'Campo multipart `file` + `folder`. Objeto privado; retorna URL lógica del objeto.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'folder'],
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: {
          type: 'string',
          enum: [...S3_FOLDERS],
        },
      },
    },
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadS3Dto,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    return this.s3Service.uploadFile(file, dto.folder);
  }
}
