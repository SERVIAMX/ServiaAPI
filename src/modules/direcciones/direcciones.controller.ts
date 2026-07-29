import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { DireccionesService } from './direcciones.service';

@ApiTags('direcciones')
@Controller('direcciones')
export class DireccionesController {
  constructor(private readonly direccionesService: DireccionesService) {}

  @Public()
  @Get('CP/:cp')
  @ApiOperation({
    summary: 'Consulta colonias/municipio por código postal (SEPOMEX)',
  })
  @ApiParam({ name: 'cp', example: '11560', description: 'Código postal' })
  findByCp(@Param('cp') cp: string) {
    return this.direccionesService.findByCodigoPostal(cp);
  }
}
