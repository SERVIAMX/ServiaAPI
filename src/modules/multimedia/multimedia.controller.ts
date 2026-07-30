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
    summary: 'Sincronizar BrandImages desde Movivendor',
    description:
      'Consulta el catálogo completo de Movivendor (misma fuente que GET /productos/marcas), extrae marca + service_logo de todos los tipos, limpia BrandImages e inserta Brand/Url. Público para ejecutar desde Swagger.',
  })
  syncBrandImages() {
    return this.multimediaService.syncBrandImagesFromMovivendor();
  }

  @Public()
  @Post('product-images/sync')
  @ApiOperation({
    summary: 'Sincronizar ProductImages desde Movivendor',
    description:
      'Lista todas las marcas y, marca por marca (equivalente a GET /productos/por-marca), inserta ServiceSKU, Url (service_logo), ServiceGroup y Brand (service_name) en ProductImages. Limpia la tabla antes. Público para Swagger.',
  })
  syncProductImages() {
    return this.multimediaService.syncProductImagesFromMovivendor();
  }
}
