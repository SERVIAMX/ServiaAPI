import { Module } from '@nestjs/common';
import { DireccionesController } from './direcciones.controller';
import { DireccionesService } from './direcciones.service';

@Module({
  controllers: [DireccionesController],
  providers: [DireccionesService],
  exports: [DireccionesService],
})
export class DireccionesModule {}
