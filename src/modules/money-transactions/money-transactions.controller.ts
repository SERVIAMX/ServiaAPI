import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { FilterMoneyTransactionsDto } from './dto/filter-money-transactions.dto';
import { MoneyTransactionsService } from './money-transactions.service';

@ApiTags('MoneyTransactions')
@ApiBearerAuth()
@Controller('money-transactions')
export class MoneyTransactionsController {
  constructor(
    private readonly moneyTransactionsService: MoneyTransactionsService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('voucher', {
      storage: memoryStorage(),
      limits: { fileSize: VOUCHER_MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!VOUCHER_ALLOWED_MIMES.has(file.mimetype)) {
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
    summary: 'Registrar movimiento de dinero (admin)',
    description:
      'Solo Super Administrador / Administrador. Type: 1 = Ingreso (suma a Bank.Amount), 2 = Retiro (resta). ' +
      '`voucher` opcional (PDF/PNG/JPG/JPEG/WEBP) → S3 `Vouchers`.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount', 'type'],
      properties: {
        amount: {
          type: 'string',
          example: '500',
          description: 'También acepta `Amount`',
        },
        type: {
          type: 'string',
          example: '1',
          description: '1 = Ingreso, 2 = Retiro. También acepta `Type`',
        },
        comments: {
          type: 'string',
          example: 'Depósito SPEI',
          description: 'También acepta `Comments` o `Comentarios`',
        },
        voucher: { type: 'string', format: 'binary' },
      },
    },
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() voucher: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const amount =
      body.amount ?? body.Amount ?? body.AMOUNT;
    const type = body.type ?? body.Type;
    const comments =
      (body.comments as string | undefined) ??
      (body.Comments as string | undefined) ??
      (body.Comentarios as string | undefined);

    return this.moneyTransactionsService.create(
      user.roleId,
      amount,
      type,
      voucher,
      comments,
    );
  }

  @Get('bank')
  @ApiOperation({
    summary: 'Obtener saldo de Bank (admin)',
    description:
      'Regresa `{ amount }` de `Bank` con Id = 1. Solo Super Administrador / Administrador.',
  })
  getBank(@CurrentUser() user: CurrentUserPayload) {
    return this.moneyTransactionsService.getBankAmount(user.roleId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar movimientos de dinero (admin)',
    description:
      'Paginado. Solo Super Administrador / Administrador. Filtro por CreatedAt con `from` / `to`.',
  })
  findByDateRange(
    @CurrentUser() user: CurrentUserPayload,
    @Query() filter: FilterMoneyTransactionsDto,
  ) {
    return this.moneyTransactionsService.findByDateRange(user.roleId, filter);
  }
}
