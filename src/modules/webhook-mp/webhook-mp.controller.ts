import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MercadoPagoWebhookDto } from './dto/mercado-pago-webhook.dto';
import { WebhookMpService } from './webhook-mp.service';

@ApiTags('WebhookMP')
@Controller('webhook-mp')
export class WebhookMpController {
  constructor(private readonly webhookMpService: WebhookMpService) {}

  @Post()
  @Public()
  @ApiBody({ type: MercadoPagoWebhookDto })
  @ApiOperation({
    summary: 'Webhook Mercado Pago',
    description:
      'Persiste en `Payments`. Si `status=processed` y `payment_status_detail=accredited`, suma `total_amount` al `Balance` del cliente (`client_id`) y registra `BalanceHistory` pagado.',
  })
  notificacion(@Body() dto: MercadoPagoWebhookDto) {
    return this.webhookMpService.recibirNotificacion(dto);
  }
}
