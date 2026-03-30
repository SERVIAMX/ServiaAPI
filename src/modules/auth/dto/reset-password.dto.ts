import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por correo' })
  @IsString()
  token: string;

  @ApiProperty({
    minLength: 8,
    description: 'Al menos 1 mayúscula, 1 número y 1 carácter especial',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'La contraseña debe incluir al menos una mayúscula, un número y un carácter especial',
  })
  newPassword: string;
}
