import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SendTestMessageDto } from './dto/send-test-message.dto';
import { TelegramService } from './telegram.service';

@ApiTags('telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('test')
  @ApiOperation({
    summary: 'Enviar mensaje de prueba al grupo de Telegram',
    description:
      'No requiere JWT. Usa TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. Útil para validar la configuración desde Swagger.',
  })
  async sendTest(@Body() dto: SendTestMessageDto) {
    const text =
      dto.message?.trim() ||
      `✅ Prueba ServiaAPI — ${new Date().toISOString()}`;
    return this.telegramService.sendTestMessage(text);
  }
}
