import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  VOUCHER_ALLOWED_MIMES,
  VOUCHER_MAX_UPLOAD_BYTES,
} from '../../common/constants/voucher-upload.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { FilterPendingAssignmentDto } from './dto/filter-pending-assignment.dto';
import { PendingAssignmentService } from './pending-assignment.service';

const MAX_UPLOAD = VOUCHER_MAX_UPLOAD_BYTES;

const VOUCHER_MIMES = VOUCHER_ALLOWED_MIMES;

@ApiTags('PendingAssignment')
@ApiBearerAuth()
@Controller('pending-assignment')
export class PendingAssignmentController {
  constructor(
    private readonly pendingAssignmentService: PendingAssignmentService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('voucher', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD },
      fileFilter: (_req, file, cb) => {
        if (!VOUCHER_MIMES.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Comprobante inválido. Use PDF, PNG, JPG, JPEG o WEBP',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Registrar abono pendiente con comprobante',
    description:
      'Cliente autenticado. Requiere `code` (ReferencesCodes vigente), voucher y amount. Crea registro con `PendingAssignment = 1`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount', 'code', 'voucher'],
      properties: {
        amount: { type: 'number', example: 200 },
        code: { type: 'string', example: '48291037', description: 'Código de referencia vigente (8 dígitos)' },
        voucher: { type: 'string', format: 'binary' },
      },
    },
  })
  register(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() voucher: Express.Multer.File,
    @Body('amount') amountRaw: string,
    @Body('code') code: string,
  ) {
    if (!user?.clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    const amount = Number(amountRaw);
    return this.pendingAssignmentService.register(
      user.clientId,
      amount,
      code,
      voucher,
      { userId: user.userId },
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar abonos pendientes (admin)',
    description:
      'Paginado. Solo `PendingAssignment = 1`. Filtro por `CreatedAt` con `from` / `to`.',
  })
  findPending(
    @CurrentUser() user: CurrentUserPayload,
    @Query() filter: FilterPendingAssignmentDto,
  ) {
    return this.pendingAssignmentService.findPending(user.roleId, filter);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Aprobar abono pendiente (admin)',
    description:
      'Cambia `PendingAssignment` a 0 y ejecuta `assignBalance` con `requiresCredit: false`.',
  })
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!user?.userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.pendingAssignmentService.approve(user.roleId, id, {
      userId: user.userId,
      clientId: user.clientId,
    });
  }
}
