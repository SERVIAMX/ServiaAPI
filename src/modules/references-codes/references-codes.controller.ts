import { Controller, Post, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/interfaces/current-user-payload.interface';
import { ReferencesCodesService } from './references-codes.service';

@ApiTags('ReferencesCodes')
@ApiBearerAuth()
@Controller('references-codes')
export class ReferencesCodesController {
  constructor(
    private readonly referencesCodesService: ReferencesCodesService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generar código de referencia',
    description:
      'Si el cliente ya tiene un código vigente (`Estatus = 1`), lo reutiliza. ' +
      'Si no, genera uno numérico de 8 dígitos único en `ReferencesCodes`. Respuesta: `{ code }`.',
  })
  generate(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.clientId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.referencesCodesService.generateForClient(user.clientId);
  }
}
