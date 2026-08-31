import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CUSTOMER_LOGO_ALLOWED_MIMES,
  CUSTOMER_LOGO_MAX_UPLOAD_BYTES,
} from '../../common/constants/customer-upload.constants';
import { PermissionAction } from '../../common/enums/permission-action.enum';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ClientsService } from './clients.service';
import { FilterClientDto } from './dto/filter-client.dto';
import { Client } from './entities/client.entity';
import { CustomerBalance } from './entities/customer-balance.entity';
import {
  parseCreateClientFormBody,
  parseUpdateClientFormBody,
} from './utils/client-form.util';

const logoInterceptor = FileInterceptor('logoUrl', {
  storage: memoryStorage(),
  limits: { fileSize: CUSTOMER_LOGO_MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!CUSTOMER_LOGO_ALLOWED_MIMES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Logo inválido. Use PNG, JPG, JPEG, WEBP o SVG',
        ) as unknown as Error,
        false,
      );
    }
    cb(null, true);
  },
});

const clientFormBodySchema = {
  type: 'object',
  properties: {
    businessName: { type: 'string' },
    tradeName: { type: 'string' },
    rfc: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    notes: { type: 'string' },
    requiresCredit: { type: 'string', example: 'true' },
    amount: { type: 'string', example: '200' },
    creditLine: { type: 'string', example: '1000' },
    discountPercentage: { type: 'string', example: '10' },
    commissionPercentage: { type: 'string', example: '3.25' },
    creditBalance: { type: 'string', example: '500' },
    lat: { type: 'string', example: '19.432608', description: 'Latitud del mapa' },
    lng: { type: 'string', example: '-99.133209', description: 'Longitud del mapa' },
    neighborhood: { type: 'string', example: 'Centro', description: 'Colonia / barrio' },
    logoUrl: {
      type: 'string',
      format: 'binary',
      description: 'Logo del cliente → S3 Customers',
    },
  },
};

const clientUpdateFormBodySchema = {
  type: 'object',
  properties: {
    businessName: { type: 'string' },
    tradeName: { type: 'string' },
    rfc: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    notes: { type: 'string' },
    creditLine: { type: 'string', example: '1000' },
    discountPercentage: { type: 'string', example: '10' },
    commissionPercentage: { type: 'string', example: '3.25' },
    lat: { type: 'string', example: '19.432608', description: 'Latitud del mapa' },
    lng: { type: 'string', example: '-99.133209', description: 'Longitud del mapa' },
    neighborhood: { type: 'string', example: 'Centro', description: 'Colonia / barrio' },
    logoUrl: {
      type: 'string',
      format: 'binary',
      description: 'Logo del cliente → S3 Customers',
    },
  },
};

@ApiTags('clients')
@ApiBearerAuth()
@ApiExtraModels(Client, CustomerBalance)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('clients', PermissionAction.READ)
  @ApiOperation({
    summary: 'Listar clientes paginados',
    description:
      'Incluye `lat`, `lng`, `neighborhood` y relación `customerBalance` (balance, creditBalance).',
  })
  @ApiOkResponse({ description: 'Listado paginado de clientes', type: Client, isArray: true })
  findAll(@Query() filter: FilterClientDto) {
    return this.clientsService.findAll(filter);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Listar todos los clientes',
    description:
      'Sin paginación ni filtros. Todos los clientes (sin soft delete) con `customerBalance`, `lat`, `lng` y `neighborhood`.',
  })
  @ApiOkResponse({ description: 'Arreglo completo de clientes', type: Client, isArray: true })
  findAllRecords() {
    return this.clientsService.findAllRecords();
  }

  @Get(':id')
  @RequirePermissions('clients', PermissionAction.READ)
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  @ApiOkResponse({
    description: 'Cliente con ubicación y customerBalance',
    type: Client,
  })
  @ApiParam({ name: 'id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }

  @Get(':id/users')
  @RequirePermissions('users', PermissionAction.READ)
  @ApiOperation({ summary: 'Listar usuarios del cliente' })
  @ApiParam({ name: 'id' })
  findUsers(
    @Param('id', ParseIntPipe) id: number,
    @Query() filter: FilterClientDto,
  ) {
    return this.clientsService.findUsersByClient(id, filter);
  }

  @Post()
  @RequirePermissions('clients', PermissionAction.CREATE)
  @UseInterceptors(logoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Crear cliente',
    description:
      'multipart/form-data. Logo en campo `logoUrl` → S3 `Customers`. Se guarda en `Clients.logoUrl`.',
  })
  @ApiBody({ schema: clientFormBodySchema })
  create(
    @Body() body: Record<string, unknown>,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const dto = parseCreateClientFormBody(body);
    return this.clientsService.create(dto, logo);
  }

  @Patch(':id')
  @RequirePermissions('clients', PermissionAction.UPDATE)
  @UseInterceptors(logoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Actualizar cliente',
    description:
      'multipart/form-data. Si envían requiresCredit, amount o creditBalance se ignoran (no afectan CustomerBalance). Para movimientos de saldo use POST /api/balance/assignBalance.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: clientUpdateFormBodySchema })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const dto = parseUpdateClientFormBody(body);
    return this.clientsService.update(id, dto, logo);
  }

  @Delete(':id')
  @RequirePermissions('clients', PermissionAction.DELETE)
  @ApiOperation({ summary: 'Eliminar cliente (soft)' })
  @ApiParam({ name: 'id' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }

  @Patch(':id/toggle-status')
  @RequirePermissions('clients', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Activar / desactivar cliente' })
  @ApiParam({ name: 'id' })
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.toggleStatus(id);
  }
}
