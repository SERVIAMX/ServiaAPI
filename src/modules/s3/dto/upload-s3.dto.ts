import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const S3_FOLDERS = [
  'LogosMarcas',
  'BrandImages',
  'ProductImages',
  'Multimedia',
  'Usuarios',
  'Clientes',
] as const;

export class UploadS3Dto {
  @ApiProperty({
    description: 'Carpeta destino en el bucket',
    enum: S3_FOLDERS,
    example: 'BrandImages',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn([...S3_FOLDERS], {
    message: `folder debe ser uno de: ${S3_FOLDERS.join(', ')}`,
  })
  folder!: string;
}
