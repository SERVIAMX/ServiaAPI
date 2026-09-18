import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import {
  PushStatusDto,
  SubscribePushDto,
  UnsubscribePushDto,
} from './dto/push-subscription.dto';
import { TestAdminPushDto } from './dto/test-admin-push.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Estado de Web Push y clave pública VAPID',
    description:
      'El frontend PWA usa `publicKey` en `PushManager.subscribe`. Si `disponible` es false, no hay claves VAPID en el servidor.',
  })
  @ApiOkResponse({ type: PushStatusDto })
  status(): PushStatusDto {
    return this.notificationsService.status();
  }

  @Post('subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Registrar o actualizar suscripción push del dispositivo',
    description:
      'multipart no aplica: JSON con `endpoint` y `keys` de la PushSubscription del navegador.',
  })
  @ApiNoContentResponse()
  async subscribe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubscribePushDto,
  ): Promise<void> {
    await this.notificationsService.subscribe(user.userId, user.clientId, dto);
  }

  @Delete('subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar suscripción push de este dispositivo' })
  @ApiNoContentResponse()
  async unsubscribe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UnsubscribePushDto,
  ): Promise<void> {
    await this.notificationsService.unsubscribe(user.userId, dto.endpoint);
  }

  @Post('test')
  @ApiOperation({
    summary: 'Enviar notificación de prueba a los dispositivos del usuario',
    description: 'Simula el aviso de saldo bajo del cliente (< 150).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { enviados: { type: 'number', example: 1 } },
    },
  })
  test(@CurrentUser() user: CurrentUserPayload): Promise<{ enviados: number }> {
    return this.notificationsService.test(user.userId);
  }

  @Post('test-admin')
  @ApiOperation({
    summary: 'Simulacro de notificaciones push para administradores',
    description:
      'Solo Super Administrador / Administrador. Envía a todos los dispositivos admin suscritos. ' +
      '`tipo`: `transaction_error`, `movivendor_low` o `all` (default).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        enviados: { type: 'number', example: 2 },
        tipos: {
          type: 'array',
          items: { type: 'string' },
          example: ['transaction_error', 'movivendor_low'],
        },
      },
    },
  })
  testAdmin(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: TestAdminPushDto,
  ) {
    return this.notificationsService.testAdmin(
      user.roleId,
      dto.tipo ?? 'all',
    );
  }
}
