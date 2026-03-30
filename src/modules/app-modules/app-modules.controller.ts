import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionAction } from '../../common/enums/permission-action.enum';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AppModulesService } from './app-modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@ApiTags('app-modules')
@ApiBearerAuth()
@Controller('app-modules')
export class AppModulesController {
  constructor(private readonly appModulesService: AppModulesService) {}

  @Get()
  @RequirePermissions('modules', PermissionAction.READ)
  @ApiOperation({ summary: 'Listar módulos con permisos' })
  findAll() {
    return this.appModulesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('modules', PermissionAction.READ)
  @ApiOperation({ summary: 'Obtener módulo' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appModulesService.findOne(id);
  }

  @Post()
  @RequirePermissions('modules', PermissionAction.CREATE)
  @ApiOperation({ summary: 'Crear módulo (y permisos estándar)' })
  create(@Body() dto: CreateModuleDto) {
    return this.appModulesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('modules', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Actualizar módulo' })
  @ApiParam({ name: 'id' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateModuleDto) {
    return this.appModulesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('modules', PermissionAction.DELETE)
  @ApiOperation({ summary: 'Eliminar módulo' })
  @ApiParam({ name: 'id' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.appModulesService.remove(id);
  }
}
