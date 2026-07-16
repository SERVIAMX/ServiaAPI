import { Body, Controller, Get, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { BalanceService } from 'src/modules/balance/balance.service';
import { Public } from '../../common/decorators/public.decorator';
import { SkipResponseInterceptor } from '../../common/decorators/skip-response-interceptor.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { AdjustCustomerBalanceDto } from './dto/adjust-customer-balance.dto';
import { FilterBalanceHistoryDto } from './dto/filter-balance-history.dto';
import { MarkBalanceHistoryPaidDto } from './dto/mark-balance-history-paid.dto';
import { RequestSelfCreditDto } from './dto/request-self-credit.dto';
import { RequestSelfCreditResponseDto } from './dto/request-self-credit-response.dto';
import type { Request } from 'express';

type AuthUser = { userId: number; clientId: number; roleId?: number };

@ApiTags('Balance')
@ApiExtraModels(RequestSelfCreditResponseDto)
@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post('movivendor')
  @Public()
  @ApiOperation({
    summary: 'Consulta saldo con Movivendor (login interno + balance)',
    description:
      'Ejecuta login contra `MOVIVENDOR_LOGIN`, obtiene token y consulta saldo en `MOVIVENDOR_BALANCE` enviando `{ token }`.',
  })
  consultarSaldoMovivendor() {
    return this.balanceService.consultarSaldoMovivendor();
  }

  @Post('assignBalance')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ajusta saldo del cliente (Balance/CreditBalance)',
    description:
      'Suma Amount sobre CustomerBalance por CustomerId. Si RequiresCredit=true suma Acreditado a CreditBalance (valida CreditLine con Amount solicitado; CreditBalance puede superar CreditLine por bonificación). No permite crédito si ya existe BalanceHistory con isPaid=0. Si RequiresCredit=false suma Acreditado a Balance (pagado).',
  })
  ajustarSaldo(@Req() req: Request, @Body() dto: AdjustCustomerBalanceDto) {
    const authUser = req.user as AuthUser | undefined;
    if (!authUser?.userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.balanceService.ajustarSaldoCliente(dto, {
      userId: authUser.userId,
      clientId: authUser.clientId,
    });
  }

  @Post('request-credit')
  @SkipResponseInterceptor()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Solicitar crédito (cliente autenticado)',
    description: [
      'El cliente solicita crédito sobre **su propia cuenta** (`clientId` del JWT).',
      '',
      '**Reglas:**',
      '- `requiresCredit` siempre es `true`.',
      '- No puede tener otro `BalanceHistory` con `isPaid = 0`.',
      '- `amount` no debe exceder `CreditLine - CreditBalance` actual.',
      '- En `CreditBalance` se suma `Acreditado` (monto con bonificación por `DiscountPercentage`).',
      '- En `BalanceHistory` se guardan `Amount` (monto SPEI) y `Acreditado`.',
      '',
      '**Respuesta:** siempre `{ success, message }` sin envoltorio estándar de la API.',
      'Los errores de negocio regresan HTTP 200 con `success: false`.',
    ].join('\n'),
  })
  @ApiBody({
    type: RequestSelfCreditDto,
    examples: {
      solicitud900: {
        summary: 'Solicitar $900 de crédito',
        value: { amount: 900 },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Resultado de la solicitud. Éxito y errores de negocio usan este mismo esquema (HTTP 200).',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(RequestSelfCreditResponseDto) },
        examples: {
          exito: {
            summary: 'Crédito asignado',
            value: {
              success: true,
              message: 'Saldo asignado correctamente',
            },
          },
          creditoPendiente: {
            summary: 'Ya tiene crédito pendiente de pago',
            value: {
              success: false,
              message:
                'El cliente tiene un abono pendiente de pago (BalanceHistory isPaid = 0). Solo puede recibir saldo pagado hasta liquidarlo.',
            },
          },
          limiteExcedido: {
            summary: 'Monto excede línea de crédito',
            value: {
              success: false,
              message:
                'El monto solicitado excede la línea de crédito disponible',
            },
          },
          sinCreditLine: {
            summary: 'Cliente sin línea de crédito',
            value: {
              success: false,
              message: 'Cliente sin CreditLine configurado',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido' })
  solicitarCredito(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RequestSelfCreditDto,
  ) {
    return this.balanceService.solicitarCreditoPropio(
      { userId: user.userId, clientId: user.clientId },
      dto.amount,
    );
  }

  @Get('customerBalance')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtiene balance del cliente autenticado',
    description:
      'Toma el clientId desde el JWT y regresa lineCredit (CreditLine), balance y creditBalance.',
  })
  customerBalance(@CurrentUser() user: CurrentUserPayload) {
    return this.balanceService.obtenerCustomerBalance(user.clientId);
  }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtiene BalanceHistory del cliente autenticado',
    description:
      'Filtra por fechaInicio/fechaFin y regresa paginado. CustomerId se toma del token (clientId).',
  })
  history(
    @CurrentUser() user: CurrentUserPayload,
    @Query() filter: FilterBalanceHistoryDto,
  ) {
    return this.balanceService.obtenerBalanceHistory(user.clientId, filter);
  }

  @Get('pending-payment-history')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Historial global pendiente de pago (solo Super Administrador / administración)',
    description:
      'Registros de `BalanceHistory` con `isPaid = 0` de todos los clientes. Incluye `customerId` y `cliente` (nombre comercial o razón social + id). Paginación y fechas opcionales como en `history`. Acceso: rol "Super Administrador", "Administrador" (nombre, sin distinguir mayúsculas) o `RoleId = 1` (portal administración).',
  })
  pendingPaymentHistoryGlobal(
    @CurrentUser() user: CurrentUserPayload,
    @Query() filter: FilterBalanceHistoryDto,
  ) {
    return this.balanceService.obtenerHistorialPendientePagoGlobal(
      user.roleId,
      filter,
    );
  }

  @Post('mark-paid')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Marcar movimiento de balance como pagado (isPaid 0 → 1)',
    description:
      'Solo si el registro tiene `isPaid = 0`. Acceso: rol "Super Administrador", "Administrador" (nombre) o `RoleId = 1`.',
  })
  markBalanceHistoryPaid(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: MarkBalanceHistoryPaidDto,
  ) {
    return this.balanceService.marcarBalanceHistoryComoPagado(user.roleId, dto);
  }
}

