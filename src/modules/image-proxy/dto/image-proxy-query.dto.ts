import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class ImageProxyQueryDto {
  @ApiProperty({
    description: 'URL absoluta de la imagen a proxificar (http/https)',
    example: 'https://vwdev.movivendor.com/wsventa/resources/img/sku/TL.svg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string;
}
