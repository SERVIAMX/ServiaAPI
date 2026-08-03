import {
  Body,
  Controller,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { CreateFavoriteBrandDto } from './dto/create-favorite-brand.dto';
import { FavoritesBrandsService } from './favorites-brands.service';

@ApiTags('favorites-brands')
@ApiBearerAuth()
@Controller('favorites-brands')
export class FavoritesBrandsController {
  constructor(private readonly favoritesService: FavoritesBrandsService) {}

  @Post()
  @ApiOperation({
    summary: 'Agregar marca a favoritos',
    description:
      'Registra la marca en FavoritesBrands para el cliente del JWT (`IdCliente`). Si ya existía inactiva (`Estatus=0`), la reactiva.',
  })
  add(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFavoriteBrandDto,
  ) {
    return this.favoritesService.add(user.clientId, dto);
  }

  @Patch('deactivate')
  @ApiOperation({
    summary: 'Desactivar favorito por marca (Estatus = 0)',
    description:
      'Busca el favorito activo del cliente por nombre de marca y pone `Estatus = 0`. Body: `{ "brand": "Telcel" }`.',
  })
  deactivateByBrand(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFavoriteBrandDto,
  ) {
    return this.favoritesService.deactivateByBrand(user.clientId, dto.brand);
  }
}
