import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  enabled: process.env.AWS_S3_ENABLED !== 'false',
  region: process.env.AWS_REGION?.trim() ?? '',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? '',
  bucket: process.env.AWS_S3_BUCKET?.trim() ?? '',
  maxUploadSize: Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024,
}));
