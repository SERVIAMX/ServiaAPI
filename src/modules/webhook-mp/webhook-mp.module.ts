import { Module } from '@nestjs/common';
import { WebhookMpController } from './webhook-mp.controller';
import { WebhookMpService } from './webhook-mp.service';

@Module({
  controllers: [WebhookMpController],
  providers: [WebhookMpService],
})
export class WebhookMpModule {}
