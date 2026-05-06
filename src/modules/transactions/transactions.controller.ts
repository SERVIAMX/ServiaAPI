import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { TransactionByExternalIdDto } from './dto/transaction-by-external-id.dto';
import { TransactionListItemDto } from './dto/transaction-list-item.dto';
import { TransactionsService } from './transactions.service';

type AuthUser = { userId: number; clientId: number };

@ApiTags('transactions')
@ApiExtraModels(TransactionListItemDto, TransactionByExternalIdDto)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar transacciones del usuario autenticado',
    description:
      'Paginado. Filtra por IdUser del token y por rango de fechas sobre FHRegister (from / to). Cada ítem incluye `isCredit` (0=Pagado, 1=Crédito) y `tipoCobro` (texto).',
  })
  @ApiOkResponse({
    description: 'Respuesta estándar: data[] incluye tipoCobro y isCredit',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Operación exitosa' },
        timestamp: { type: 'string' },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(TransactionListItemDto) },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAll(@Req() req: Request, @Query() filter: FilterTransactionsDto) {
    const authUser = req.user as AuthUser | undefined;
    const userId = authUser?.userId;
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');
    return this.transactionsService.findByUserAndDateRange(userId, filter);
  }

  @Get('external/:externalId')
  @Public()
  @ApiOperation({
    summary: 'Obtener transacción por ExternalId',
    description:
      'Endpoint público: busca por ExternalId. Regresa un solo objeto con tipoCobro/isCredit y recargaEstado.',
  })
  @ApiOkResponse({
    description: 'Respuesta estándar: data incluye tipoCobro y isCredit',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Operación exitosa' },
        timestamp: { type: 'string' },
        data: { $ref: getSchemaPath(TransactionByExternalIdDto) },
      },
    },
  })
  findByExternalId(@Param('externalId') externalId: string) {
    return this.transactionsService.findByExternalId(externalId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'CreateTransaction',
    description:
      'Crea registro en Transactions, genera ExternalId con RFC+yyyyMMddHHmmss y ejecuta /productos/venta. El code se actualiza desde Movivendor.',
  })
  createTransaction(@Req() req: Request, @Body() dto: CreateTransactionDto) {
    const authUser = req.user as AuthUser | undefined;
    return this.transactionsService.createTransaction(
      { userId: authUser?.userId ?? 0, clientId: authUser?.clientId ?? 0 },
      dto,
    );
  }
}

