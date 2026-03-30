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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RemovePermissionsDto } from './dto/remove-permissions.dto';
import { FilterRoleDto } from './dto/filter-role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles', PermissionAction.READ)
  @ApiOperation({ summary: 'Listar roles con permisos agrupados' })
  findAll(@Query() filter: FilterRoleDto) {
    return this.rolesService.findAll(filter);
  }

  @Get(':id')
  @RequirePermissions('roles', PermissionAction.READ)
  @ApiOperation({ summary: 'Obtener rol con permisos' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions('roles', PermissionAction.CREATE)
  @ApiOperation({ summary: 'Crear rol' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('roles', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Actualizar rol' })
  @ApiParam({ name: 'id' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('roles', PermissionAction.DELETE)
  @ApiOperation({ summary: 'Eliminar rol (solo si no es de sistema)' })
  @ApiParam({ name: 'id' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @RequirePermissions('roles', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reemplazar permisos del rol' })
  @ApiParam({ name: 'id' })
  assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, dto.permissionIds);
  }

  @Delete(':id/permissions')
  @RequirePermissions('roles', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Quitar permisos del rol' })
  @ApiParam({ name: 'id' })
  removePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RemovePermissionsDto,
  ) {
    return this.rolesService.removePermissions(id, dto.permissionIds);
  }
}
