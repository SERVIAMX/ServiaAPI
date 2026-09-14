import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushKeysDto {
  @ApiProperty({ description: 'Clave p256dh de la PushSubscription del navegador' })
  @IsString()
  @MaxLength(255)
  p256dh: string;

  @ApiProperty({ description: 'Clave auth de la PushSubscription del navegador' })
  @IsString()
  @MaxLength(255)
  auth: string;
}

export class SubscribePushDto {
  @ApiProperty({
    description: 'URL endpoint que entrega el navegador al suscribirse a push',
  })
  @IsString()
  @MaxLength(500)
  endpoint: string;

  @ApiProperty({ type: PushKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @ApiPropertyOptional({
    example: 'America/Mexico_City',
    description: 'Zona IANA del dispositivo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}

export class UnsubscribePushDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  endpoint: string;
}

export class PushStatusDto {
  @ApiProperty({ description: 'true si hay claves VAPID configuradas' })
  disponible: boolean;

  @ApiProperty({
    nullable: true,
    description: 'Clave pública VAPID para PushManager.subscribe',
  })
  publicKey: string | null;

  @ApiProperty({
    description: 'Umbral en pesos para aviso de saldo bajo',
    example: 150,
  })
  lowBalanceThreshold: number;
}
