import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { CreateSupplierPurchaseDto } from './dto/create-supplier-purchase.dto';
import { FilterSupplierPurchasesDto } from './dto/filter-supplier-purchases.dto';
import { SupplierPurchasesService } from './supplier-purchases.service';

@ApiTags('SupplierPurchases')
@ApiBearerAuth()
@Controller('supplier-purchases')
export class SupplierPurchasesController {
  constructor(
    private readonly supplierPurchasesService: SupplierPurchasesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar compra a proveedor',
    description:
      'Solo Super Administrador. Type: 1 = Tiempo_aire, 2 = Servicios.',
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSupplierPurchaseDto,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.supplierPurchasesService.create(dto, { roleId: user.roleId });
  }

  @Get()
  @ApiOperation({
    summary: 'Listar compras a proveedor por rango de fechas',
    description:
      'Paginado. Filtra por FHRegistro con `from` / `to` (YYYY-MM-DD o ISO).',
  })
  findByDateRange(@Query() filter: FilterSupplierPurchasesDto) {
    return this.supplierPurchasesService.findByDateRange(filter);
  }
}
