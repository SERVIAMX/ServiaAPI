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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { prospectEstatusFormFieldSchema } from '../../common/swagger/prospect-estatus.swagger';
import {
  CUSTOMER_LOGO_ALLOWED_MIMES,
  CUSTOMER_LOGO_MAX_UPLOAD_BYTES,
} from '../../common/constants/customer-upload.constants';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionAction } from '../../common/enums/permission-action.enum';
import { FilterProspectDto } from './dto/filter-prospect.dto';
import { CreateProspectDto } from './dto/create-prospect.dto';
import { UpdateProspectDto } from './dto/update-prospect.dto';
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

const prospectFormBodySchema = {
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
    estatus: prospectEstatusFormFieldSchema,
    logoUrl: {
      type: 'string',
      format: 'binary',
      description: 'Logo del prospecto → S3 Prospects',
    },
  },
};

const convertProspectFormBodySchema = {
  type: 'object',
  required: ['requiresCredit'],
  properties: {
    requiresCredit: { type: 'string', example: 'true' },
    amount: { type: 'string', example: '200' },
    creditLine: { type: 'string', example: '1000' },
    discountPercentage: { type: 'string', example: '10' },
    commissionPercentage: { type: 'string', example: '3.25' },
    creditBalance: { type: 'string', example: '500' },
    logoUrl: {
      type: 'string',
      format: 'binary',
      description:
        'Logo opcional. Si no se envía, se usa el logo del prospecto.',
    },
  },
};

@ApiTags('prospects')
@ApiBearerAuth()
@ApiExtraModels(Prospect, CreateProspectDto, UpdateProspectDto, FilterProspectDto)
@Controller('prospects')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Get()
  @RequirePermissions('prospects', PermissionAction.READ)
  @ApiOperation({
    summary: 'Listar prospectos paginados',
    description:
      'Por defecto excluye convertidos (3) y descartados (4). Usa query `estatus` con valores de **ProspectEstatus** para filtrar.',
  })
  findAll(@Query() filter: FilterProspectDto) {
    return this.prospectsService.findAll(filter);
  }

  @Get(':id')
  @RequirePermissions('prospects', PermissionAction.READ)
  @ApiOperation({ summary: 'Obtener prospecto por ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.findOne(id);
  }

  @Post()
  @RequirePermissions('prospects', PermissionAction.CREATE)
  @UseInterceptors(logoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Crear prospecto',
    description:
      'multipart/form-data. Logo en campo `logoUrl` → S3 `Prospects`. Se guarda en `Prospects.logoUrl`.',
  })
  @ApiBody({ schema: prospectFormBodySchema })
  create(
    @Body() body: Record<string, unknown>,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const dto = parseCreateProspectFormBody(body);
    return this.prospectsService.create(dto, logo);
  }

  @Patch(':id')
  @RequirePermissions('prospects', PermissionAction.UPDATE)
  @UseInterceptors(logoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Actualizar prospecto',
    description:
      'multipart/form-data. Si envías `logoUrl` (archivo), reemplaza el logo en S3 `Prospects`.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: prospectFormBodySchema })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const dto = parseUpdateProspectFormBody(body);
    return this.prospectsService.update(id, dto, logo);
  }

  @Delete(':id')
  @RequirePermissions('prospects', PermissionAction.DELETE)
  @ApiOperation({ summary: 'Eliminar prospecto (soft)' })
  @ApiParam({ name: 'id' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.remove(id);
  }

  @Patch(':id/toggle-status')
  @RequirePermissions('prospects', PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Activar / desactivar prospecto' })
  @ApiParam({ name: 'id' })
  toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.toggleStatus(id);
  }

  @Post(':id/convert-to-client')
  @RequirePermissions('prospects', PermissionAction.UPDATE)
  @UseInterceptors(logoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Convertir prospecto a cliente',
    description:
      'Copia los datos del prospecto, crea un cliente con saldo/crédito inicial y elimina el prospecto (soft delete). Logo opcional en `logoUrl`; si no se envía, se reutiliza el del prospecto.',
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
