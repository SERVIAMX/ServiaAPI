import {

  Body,

  Controller,

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
  convertProspectFormBodySchema,
  prospectCreateFormBodySchema,
  prospectUpdateFormBodySchema,
} from '../../common/swagger/client-prospect-form.swagger';

import {
  CUSTOMER_LOGO_MAX_UPLOAD_BYTES,
} from '../../common/constants/customer-upload.constants';

import { FilterProspectDto } from './dto/filter-prospect.dto';

import { CreateProspectDto } from './dto/create-prospect.dto';

import { UpdateProspectDto } from './dto/update-prospect.dto';

import { UpdateProspectEstatusDto } from './dto/update-prospect-estatus.dto';

import { Prospect } from './entities/prospect.entity';

import { ProspectsService } from './prospects.service';

import {

  parseConvertProspectFormBody,

  parseCreateProspectFormBody,

  parseUpdateProspectFormBody,

} from './utils/prospect-form.util';



const logoInterceptor = FileInterceptor('logoUrl', {

  storage: memoryStorage(),

  limits: { fileSize: CUSTOMER_LOGO_MAX_UPLOAD_BYTES },

});



@ApiTags('prospects')

@ApiBearerAuth()

@ApiExtraModels(

  Prospect,

  CreateProspectDto,

  UpdateProspectDto,

  UpdateProspectEstatusDto,

  FilterProspectDto,

)

@Controller('prospects')

export class ProspectsController {

  constructor(private readonly prospectsService: ProspectsService) {}



  @Get()

  @ApiOperation({

    summary: 'Listar prospectos paginados',

    description:

      'Por defecto solo incluye estatus 1 (Nuevo), 2 (En seguimiento) y 4 (Descartado). Excluye convertidos (3). Filtro opcional: `estatus`.',

  })

  @ApiOkResponse({ description: 'Listado paginado de prospectos', type: Prospect, isArray: true })

  findAll(@Query() filter: FilterProspectDto) {

    return this.prospectsService.findAll(filter);

  }



  @Get('all')

  @ApiOperation({

    summary: 'Listar todos los prospectos (sin paginación)',

    description:

      'Sin paginación ni filtros. Todos los prospectos con estatus 1, 2 o 4 (excluye convertidos).',

  })

  @ApiOkResponse({ description: 'Arreglo completo de prospectos', type: Prospect, isArray: true })

  findAllRecords() {

    return this.prospectsService.findAllRecords();

  }



  @Get(':id')

  @ApiOperation({ summary: 'Obtener prospecto por ID' })

  @ApiOkResponse({ description: 'Prospecto con lat, lng y neighborhood', type: Prospect })

  @ApiParam({ name: 'id' })

  findOne(@Param('id', ParseIntPipe) id: number) {

    return this.prospectsService.findOne(id);

  }



  @Post()

  @UseInterceptors(logoInterceptor)

  @ApiConsumes('multipart/form-data')

  @ApiOperation({

    summary: 'Crear prospecto',

    description:

      'multipart/form-data. **Obligatorios:** `businessName`, `email`. ' +

      'Resto opcional (`estatus` por defecto `1` Nuevo). Logo opcional en `logoUrl` → S3 `Prospects`.',

  })

  @ApiBody({ schema: prospectCreateFormBodySchema })

  create(

    @Body() body: Record<string, unknown>,

    @UploadedFile() logo?: Express.Multer.File,

  ) {

    const dto = parseCreateProspectFormBody(body);

    return this.prospectsService.create(dto, logo);

  }



  @Patch(':id/estatus')

  @ApiOperation({

    summary: 'Cambiar estatus del prospecto',

    description:

      '**Obligatorio:** `estatus` (`1` Nuevo, `2` En seguimiento o `4` Descartado). ' +

      'Para convertir a cliente use `POST /prospects/:id/convert-to-client`.',

  })

  @ApiParam({ name: 'id' })

  @ApiBody({ type: UpdateProspectEstatusDto })

  changeEstatus(

    @Param('id', ParseIntPipe) id: number,

    @Body() dto: UpdateProspectEstatusDto,

  ) {

    return this.prospectsService.changeEstatus(id, dto.estatus);

  }



  @Patch(':id')

  @UseInterceptors(logoInterceptor)

  @ApiConsumes('multipart/form-data')

  @ApiOperation({

    summary: 'Actualizar prospecto',

    description:

      'multipart/form-data. Todos los campos son opcionales. Para cambiar estatus use `PATCH /prospects/:id/estatus`.',

  })

  @ApiParam({ name: 'id' })

  @ApiBody({ schema: prospectUpdateFormBodySchema })

  update(

    @Param('id', ParseIntPipe) id: number,

    @Body() body: Record<string, unknown>,

    @UploadedFile() logo?: Express.Multer.File,

  ) {

    const dto = parseUpdateProspectFormBody(body);

    return this.prospectsService.update(id, dto, logo);

  }



  @Post(':id/convert-to-client')

  @UseInterceptors(logoInterceptor)

  @ApiConsumes('multipart/form-data')

  @ApiOperation({

    summary: 'Convertir prospecto a cliente',

    description:

      '**Obligatorio:** `requiresCredit`. ' +

      'Si `requiresCredit=true`: `creditBalance` (> 0) y `creditLine`. ' +

      'Si `requiresCredit=false`: `amount` (> 0). ' +

      'Copia datos del prospecto, crea cliente y marca prospecto como convertido (`estatus = 3`). Logo opcional.',

  })

  @ApiParam({ name: 'id' })

  @ApiBody({ schema: convertProspectFormBodySchema })

  convertToClient(

    @Param('id', ParseIntPipe) id: number,

    @Body() body: Record<string, unknown>,

    @UploadedFile() logo?: Express.Multer.File,

  ) {

    const dto = parseConvertProspectFormBody(body);

    return this.prospectsService.convertToClient(id, dto, logo);

  }

}


