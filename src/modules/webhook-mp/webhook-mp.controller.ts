import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { WebhookMpService } from './webhook-mp.service';

@ApiTags('WebhookMP')
@Controller('webhook-mp')
export class WebhookMpController {
  constructor(private readonly webhookMpService: WebhookMpService) {}

  @Post()
  @Public()
  @ApiOperation({
    summary: 'Webhook Mercado Pago',
    description:
      'Recibe notificaciones de Mercado Pago. Por ahora solo registra el body en logs del servidor.',
  })
  notificacion(@Body() body: unknown) {
    return this.webhookMpService.recibirNotificacion(body);
  }
}
