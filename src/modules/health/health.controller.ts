import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado del servidor y hora (CST México)' })
  health() {
    const d = new Date();
    const local = d
      .toLocaleString('sv-SE', {
        timeZone: 'America/Mexico_City',
        hour12: false,
      })
      .replace(' ', 'T');
    return {
      serverTime: `${local}.000-06:00`,
      timezone: 'America/Mexico_City',
    };
  }
}
