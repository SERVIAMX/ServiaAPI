import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
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
import type { Request, Response } from 'express';
import { SkipResponseInterceptor } from '../../common/decorators/skip-response-interceptor.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CheckStatusDto } from './dto/check-status.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { TransactionByExternalIdDto } from './dto/transaction-by-external-id.dto';
import { TransactionListItemDto } from './dto/transaction-list-item.dto';
import { TransactionsService } from './transactions.service';

type AuthUser = { userId: number; clientId: number; roleId?: number };

@ApiTags('transactions')
@ApiExtraModels(TransactionListItemDto, TransactionByExternalIdDto)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('all/excel')
  @SkipResponseInterceptor()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Exportar todas las transacciones a Excel',
    description:
      'Descarga Excel con rango `from`/`to` sobre FHRegister. Columnas: ExternalId, Hora inicio y una columna SaleCheck N por cada check-status de ese ExternalId. Solo rol 1.',
  })
  async exportAllExcel(
    @Req() req: Request,
    @Query() filter: FilterTransactionsDto,
    @Res() res: Response,
  ) {
    const authUser = req.user as AuthUser | undefined;
    if (authUser?.roleId !== 1) {
      throw new ForbiddenException('Solo rol 1 puede consultar este recurso');
    }
    const { buffer, filename } =
      await this.transactionsService.exportExcelAll(filter);
    res.set({
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get('all')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar todas las transacciones (sin filtrar por usuario)',
    description:
      'Paginado. Filtra únicamente por rango de fechas sobre FHRegister (from / to). Cada ítem incluye `isCredit` (0=Pagado, 1=Crédito) y `tipoCobro` (texto).',
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
  findAllNoUser(@Req() req: Request, @Query() filter: FilterTransactionsDto) {
    const authUser = req.user as AuthUser | undefined;
    if (authUser?.roleId !== 1) {
      throw new ForbiddenException('Solo rol 1 puede consultar este recurso');
    }
    return this.transactionsService.findByDateRange(filter);
  }

  @Get('excel')
  @SkipResponseInterceptor()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Exportar transacciones del usuario a Excel',
    description:
      'Descarga Excel filtrado por usuario autenticado y rango `from`/`to`. Columnas: ExternalId, Hora inicio y SaleCheck N (fecha/hora) por cada check-status.',
  })
  async exportExcel(
    @Req() req: Request,
    @Query() filter: FilterTransactionsDto,
    @Res() res: Response,
  ) {
    const authUser = req.user as AuthUser | undefined;
    const userId = authUser?.userId;
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');
    const { buffer, filename } =
      await this.transactionsService.exportExcelByUser(userId, filter);
    res.set({
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

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
    if (!authUser?.userId || !authUser?.clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.transactionsService.createTransaction(
      { userId: authUser.userId, clientId: authUser.clientId },
      dto,
    );
  }

  @Post('check-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'CheckStatus',
    description:
      'Consulta estatus en Movivendor (`MOVIVENDOR_CHECK_STATUS` / `check/tx`). Body: `externalId`. Busca en `Transactions` o `TransactionsHistory` y arma el payload con SKU, destination, amount e id.',
  })
  checkStatus(@Req() req: Request, @Body() dto: CheckStatusDto) {
    const authUser = req.user as AuthUser | undefined;
    return this.transactionsService.checkStatus(dto.externalId, authUser);
  }
}

