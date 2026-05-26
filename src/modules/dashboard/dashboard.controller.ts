import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { DashboardService } from './dashboard.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  @ApiBearerAuth()
  @ApiBody({
    type: DashboardFilterDto,
    required: false,
    examples: {
      diaActual: {
        summary: 'Día actual (recomendado)',
        description: 'Body vacío o fechas omitidas/vacías',
        value: {},
      },
      diaActualStringsVacios: {
        summary: 'Día actual (strings vacíos)',
        value: { fechaInicio: '', fechaFin: '' },
      },
      rangoPersonalizado: {
        summary: 'Rango de fechas',
        value: {
          fechaInicio: '2026-05-01',
          fechaFin: '2026-05-31',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Métricas del dashboard (Super Administrador / Administrador)',
    description:
      'Body opcional: `fechaInicio`/`fechaFin` filtran métricas de `TransactionsHistory`. `saldoPorCliente`: top 4 por `CustomerBalance.balance`. Sin fechas → día actual (México).',
  })
  obtenerDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: DashboardFilterDto,
  ) {
    return this.dashboardService.obtenerDashboard(user.roleId, dto);
  }
}
