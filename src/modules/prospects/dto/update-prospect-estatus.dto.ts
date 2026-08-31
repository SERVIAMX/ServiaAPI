import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';
import {
  PROSPECT_ESTATUS_VALUES,
  ProspectEstatus,
} from '../../../common/enums/prospect-estatus.enum';
import { prospectEstatusApiProperty } from '../../../common/swagger/prospect-estatus.swagger';

const CHANGEABLE_ESTATUS = PROSPECT_ESTATUS_VALUES.filter(
  (v) => v !== ProspectEstatus.CONVERTIDO,
);

export class UpdateProspectEstatusDto {
  @ApiProperty({
    ...prospectEstatusApiProperty,
    description: [
      prospectEstatusApiProperty.description,
      'No se puede asignar `3` (CONVERTIDO) aquí; use `POST /prospects/:id/convert-to-client`.',
    ].join('\n'),
    enum: CHANGEABLE_ESTATUS,
  })
  @IsInt()
  @IsIn(CHANGEABLE_ESTATUS)
  estatus: ProspectEstatus;
}
