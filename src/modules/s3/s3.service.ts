import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import { extname } from 'path';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

export interface S3UploadOptions {
  /** Si true, acepta cualquier MIME (p. ej. logos de clientes/prospectos). */
  allowAnyMime?: boolean;
  /** Tamaño máximo en bytes; por defecto usa la config global de S3. */
  maxSizeBytes?: number;
}

@Injectable()
export class S3Service {
  private readonly s3Client?: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly maxSize: number;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('aws.region') ??
      this.configService.get<string>('AWS_REGION')?.trim() ??
      '';
    const accessKeyId =
      this.configService.get<string>('aws.accessKeyId') ??
      this.configService.get<string>('AWS_ACCESS_KEY_ID')?.trim() ??
      '';
    const secretAccessKey =
      this.configService.get<string>('aws.secretAccessKey') ??
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY')?.trim() ??
      '';
    this.bucket =
      this.configService.get<string>('aws.bucket') ??
      this.configService.get<string>('AWS_S3_BUCKET')?.trim() ??
      '';
    this.region = region;
    this.maxSize =
      this.configService.get<number>('aws.maxUploadSize') ??
      (Number(this.configService.get<string>('UPLOAD_MAX_SIZE')) ||
        10 * 1024 * 1024);

    const awsEnabled = this.configService.get<boolean>('aws.enabled');
    const s3ExplicitlyDisabled =
      awsEnabled === false ||
      this.configService.get<string>('AWS_S3_ENABLED') === 'false';

    const credentialsComplete = Boolean(
      region && accessKeyId && secretAccessKey && this.bucket,
    );

    this.enabled = !s3ExplicitlyDisabled && credentialsComplete;

    if (this.enabled) {
      this.s3Client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  private ensureConfigured(): void {
    if (!this.enabled || !this.s3Client) {
      throw new ServiceUnavailableException(
        'S3 no está configurado. Complete AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y AWS_S3_BUCKET (o use AWS_S3_ENABLED=false para omitir).',
      );
    }
  }

  private extensionFromMime(mimetype: string): string | undefined {
    return EXT_BY_MIME[mimetype];
  }

  private extensionFromFile(file: Express.Multer.File): string {
    const fromMime = this.extensionFromMime(file.mimetype);
    if (fromMime) return fromMime;

    const fromName = extname(file.originalname || '')
      .replace(/^\./, '')
      .toLowerCase();
    if (fromName && /^[a-z0-9]{1,10}$/.test(fromName)) {
      return fromName;
    }

    return 'bin';
  }

  private buildObjectUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    options?: S3UploadOptions,
  ): Promise<{ url: string; key: string }> {
    this.ensureConfigured();

    if (!file?.buffer?.length) {
      throw new BadRequestException('El archivo es obligatorio.');
    }

    if (!options?.allowAnyMime && !ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Use PNG, JPG, WEBP, SVG o PDF.',
      );
    }

    if (file.size > (options?.maxSizeBytes ?? this.maxSize)) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo (${options?.maxSizeBytes ?? this.maxSize} bytes).`,
      );
    }

    const folderClean = folder.trim().replace(/^\/+|\/+$/g, '');
    if (!folderClean) {
      throw new BadRequestException('folder es obligatorio.');
    }

    const ext = this.extensionFromFile(file);
    const key = `${folderClean}/${randomUUID()}.${ext}`;

    try {
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'private',
        }),
      );

      return { url: this.buildObjectUrl(key), key };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'No se pudo subir el archivo a S3.',
      );
    }
  }

  async getPresignedUrl(
    key: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    this.ensureConfigured();

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client!, command, {
      expiresIn: expiresInSeconds,
    });
  }
}
