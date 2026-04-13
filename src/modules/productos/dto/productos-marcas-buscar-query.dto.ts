import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { ProductosMarcasQueryDto } from './productos-marcas-query.dto';

export class ProductosMarcasBuscarQueryDto extends ProductosMarcasQueryDto {
  @ApiProperty({
    example: 'tel',
    description:
      'Subcadena del nombre de marca: equivalencia a SQL `LIKE %valor%` (sin distinguir mayúsculas).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  nombre!: string;
}
