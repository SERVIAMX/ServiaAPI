import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

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

  @ApiProperty()
  @IsString()
  @Match('newPassword', { message: 'confirmPassword debe coincidir con newPassword' })
  confirmPassword: string;

  @ApiPropertyOptional({
    description:
      'Refresh token actual para mantener la sesión tras el cambio (opcional)',
  })
  @IsOptional()
  @IsString()
  currentRefreshToken?: string;
}
