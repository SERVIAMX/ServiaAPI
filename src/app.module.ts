import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { createTypeOrmOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { AppModulesModule } from './modules/app-modules/app-modules.module';
import { ClientsModule } from './modules/clients/clients.module';
import { HealthModule } from './modules/health/health.module';
import { ProductosModule } from './modules/productos/productos.module';
import { Role } from './modules/roles/entities/role.entity';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => createTypeOrmOptions(cfg),
    }),
    TypeOrmModule.forFeature([Role]),
    AuthModule,
    UsersModule,
    ClientsModule,
    RolesModule,
    AppModulesModule,
    HealthModule,
    ProductosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
