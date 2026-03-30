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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionAction } from '../../common/enums/permission-action.enum';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { FilterClientDto } from './dto/filter-client.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('clients', PermissionAction.READ)
  @ApiOperation({ summary: 'Listar clientes paginados' })
  findAll(@Query() filter: FilterClientDto) {
    return this.clientsService.findAll(filter);
  }

  @Get(':id')
  @RequirePermissions('clients', PermissionAction.READ)
  @ApiOperation({ summary: 'Obtener cliente por ID' })
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
  @ApiOperation({ summary: 'Crear cliente' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Actualizar cliente' })
  @ApiParam({ name: 'id' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
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
