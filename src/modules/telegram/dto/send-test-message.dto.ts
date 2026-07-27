import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTestMessageDto {
  @ApiPropertyOptional({
    description: 'Texto a enviar al grupo. Si se omite, se usa un mensaje de prueba por defecto.',
    example: 'Hola desde ServiaAPI',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
