import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BalanceService } from 'src/modules/balance/balance.service';
import { Public } from '../../common/decorators/public.decorator';

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
}

