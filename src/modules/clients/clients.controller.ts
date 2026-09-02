import {
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
  CUSTOMER_LOGO_MAX_UPLOAD_BYTES,
} from '../../common/constants/customer-upload.constants';
import { PermissionAction } from '../../common/enums/permission-action.enum';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  clientCreateFormBodySchema,
  clientUpdateFormBodySchema,
} from '../../common/swagger/client-prospect-form.swagger';
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
});

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
      'multipart/form-data. **Obligatorios:** `businessName`, `email`, `requiresCredit`. ' +
      'Si `requiresCredit=true`: `creditBalance` (> 0) y `creditLine`. ' +
      'Si `requiresCredit=false`: `amount` (> 0). Logo opcional en `logoUrl` → S3 `Customers`.',
  })
  @ApiBody({ schema: clientCreateFormBodySchema })
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
      'multipart/form-data. Todos los campos son opcionales. `requiresCredit`, `amount` y `creditBalance` se ignoran. ' +
      'Para movimientos de saldo use POST /api/balance/assignBalance.',
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
