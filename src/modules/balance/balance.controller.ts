import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BalanceService } from 'src/modules/balance/balance.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { AdjustCustomerBalanceDto } from './dto/adjust-customer-balance.dto';
import { FilterBalanceHistoryDto } from './dto/filter-balance-history.dto';

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
      'Suma Amount sobre CustomerBalance por CustomerId. Si RequiresCredit=true suma a CreditBalance (validando contra CreditLine). Si false suma a Balance. Registra BalanceHistory (type 2 crédito, type 1 pagado).',
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
}

