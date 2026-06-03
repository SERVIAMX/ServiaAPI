import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BalanceService } from 'src/modules/balance/balance.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { AdjustCustomerBalanceDto } from './dto/adjust-customer-balance.dto';
import { FilterBalanceHistoryDto } from './dto/filter-balance-history.dto';
import { MarkBalanceHistoryPaidDto } from './dto/mark-balance-history-paid.dto';

@ApiTags('Balance')
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
      'Suma Amount sobre CustomerBalance por CustomerId. Si RequiresCredit=true suma a CreditBalance (validando CreditLine). No permite crédito si ya existe BalanceHistory con isPaid=0. Si RequiresCredit=false suma a Balance (pagado).',
  })
  ajustarSaldo(@Body() dto: AdjustCustomerBalanceDto) {
    return this.balanceService.ajustarSaldoCliente(dto);
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

