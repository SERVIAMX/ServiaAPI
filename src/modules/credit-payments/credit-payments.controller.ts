import {
  BadRequestException,
  Body,
  Controller,
  Post,
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
  S3_VOUCHERS_FOLDER,
  VOUCHER_ALLOWED_MIMES,
  VOUCHER_MAX_UPLOAD_BYTES,
} from '../../common/constants/voucher-upload.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { CreditPaymentsService } from './credit-payments.service';

@ApiTags('CreditPayments')
@ApiBearerAuth()
@Controller('credit-payments')
export class CreditPaymentsController {
  constructor(private readonly creditPaymentsService: CreditPaymentsService) {}

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
    summary: 'Registrar pago de crédito con comprobante',
    description:
      'Recibe `idHistoryBalance`, `code` (ReferencesCodes vigente) y `voucher`. ' +
      `Sube el comprobante a S3 (\`${S3_VOUCHERS_FOLDER}\`).`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['idHistoryBalance', 'code', 'voucher'],
      properties: {
        idHistoryBalance: { type: 'integer', example: 45 },
        code: { type: 'string', example: '48291037' },
        voucher: { type: 'string', format: 'binary' },
      },
    },
  })
  register(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() voucher: Express.Multer.File,
    @Body('idHistoryBalance') idHistoryBalanceRaw: string,
    @Body('code') code: string,
  ) {
    if (!user?.clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    const idHistoryBalance = Number(idHistoryBalanceRaw);
    return this.creditPaymentsService.register(
      user.clientId,
      idHistoryBalance,
      code,
      voucher,
    );
  }
}
