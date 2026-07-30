import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { MultimediaService } from './multimedia.service';

@ApiTags('multimedia')
@Controller('multimedia')
export class MultimediaController {
  constructor(private readonly multimediaService: MultimediaService) {}

  @Public()
  @Post('brand-images/sync')
  @ApiOperation({
    summary: 'Sincronizar BrandImages (solo faltantes)',
    description:
      'Consulta marcas en Movivendor e inserta en BrandImages solo las que aún no existen (por Brand). Url siempre queda null (no copia service_logo). No borra ni actualiza filas existentes.',
  })
  syncBrandImages() {
    return this.multimediaService.syncBrandImagesFromMovivendor();
  }

  @Public()
  @Post('product-images/sync')
  @ApiOperation({
    summary: 'Sincronizar ProductImages (solo faltantes)',
    description:
      'Lista marcas y productos (como por-marca) e inserta en ProductImages solo los faltantes (clave ServiceSKU). Url siempre null. No borra ni actualiza existentes.',
  })
  syncProductImages() {
    return this.multimediaService.syncProductImagesFromMovivendor();
  }
}
