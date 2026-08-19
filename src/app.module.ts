import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import awsConfig from './config/aws.config';
import { createTypeOrmOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { AppModulesModule } from './modules/app-modules/app-modules.module';
import { BalanceModule } from './modules/balance/balance.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DireccionesModule } from './modules/direcciones/direcciones.module';
import { HealthModule } from './modules/health/health.module';
import { ProductosModule } from './modules/productos/productos.module';
import { Role } from './modules/roles/entities/role.entity';
import { RolesModule } from './modules/roles/roles.module';
import { S3Module } from './modules/s3/s3.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { WebhookMpModule } from './modules/webhook-mp/webhook-mp.module';
import { ImageProxyModule } from './modules/image-proxy/image-proxy.module';
import { MultimediaModule } from './modules/multimedia/multimedia.module';
import { BrandImagesModule } from './modules/brand-images/brand-images.module';
import { FavoritesBrandsModule } from './modules/favorites-brands/favorites-brands.module';
import { RedisModule } from './modules/redis/redis.module';
import { SupplierPurchasesModule } from './modules/supplier-purchases/supplier-purchases.module';
import { ReferencesCodesModule } from './modules/references-codes/references-codes.module';
import { PendingAssignmentModule } from './modules/pending-assignment/pending-assignment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [awsConfig],
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => createTypeOrmOptions(cfg),
    }),
    TypeOrmModule.forFeature([Role]),
    RedisModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    RolesModule,
    AppModulesModule,
    HealthModule,
    ProductosModule,
    BalanceModule,
    DashboardModule,
    DireccionesModule,
    TransactionsModule,
    WebhookMpModule,
    ImageProxyModule,
    TelegramModule,
    MultimediaModule,
    BrandImagesModule,
    FavoritesBrandsModule,
    S3Module,
    SupplierPurchasesModule,
    ReferencesCodesModule,
    PendingAssignmentModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
