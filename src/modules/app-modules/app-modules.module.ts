import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../roles/entities/permission.entity';
import { AppModuleEntity } from './entities/app-module.entity';
import { AppModulesController } from './app-modules.controller';
import { AppModulesService } from './app-modules.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppModuleEntity, Permission])],
  controllers: [AppModulesController],
  providers: [AppModulesService],
})
export class AppModulesModule {}
