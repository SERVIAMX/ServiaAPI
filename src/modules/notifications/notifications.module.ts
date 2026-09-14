import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerBalance } from '../clients/entities/customer-balance.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WebPushSender } from './web-push.sender';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription, CustomerBalance])],
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushSender],
  exports: [NotificationsService],
})
export class NotificationsModule {}
