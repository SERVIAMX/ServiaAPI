import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFavoriteBrandDto {
  @ApiProperty({
    description: 'Nombre de la marca a agregar a favoritos',
    example: 'Telcel',
    maxLength: 400,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  brand!: string;
}
