import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { ProspectEstatus } from '../../../common/enums/prospect-estatus.enum';
import { prospectEstatusApiProperty } from '../../../common/swagger/prospect-estatus.swagger';

@Entity({ name: 'Prospects' })
export class Prospect {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 200 })
  businessName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tradeName: string | null;

  @Column({ type: 'varchar', length: 13, nullable: true, unique: true })
  rfc: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 100, default: 'México' })
  country: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  isActive: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({
    type: 'datetime',
    comment: 'Fecha de registro (CST México)',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'datetime',
    comment: 'Fecha de última actualización (CST México)',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'datetime',
    nullable: true,
    comment: 'Fecha de eliminación lógica (CST México)',
  })
  @Exclude()
  @ApiHideProperty()
  deletedAt: Date | null;

  /** Ver `ProspectEstatus` en Swagger (components/schemas). */
  @ApiPropertyOptional({
    ...prospectEstatusApiProperty,
    nullable: true,
  })
  @Column({ type: 'tinyint', nullable: true })
  estatus: ProspectEstatus | null;

  @ApiPropertyOptional({
    description: 'Latitud del punto en mapa',
    example: 19.432608,
  })
  @Column({ type: 'double', nullable: true })
  lat: number | null;

  @ApiPropertyOptional({
    description: 'Longitud del punto en mapa',
    example: -99.133209,
  })
  @Column({ type: 'double', nullable: true })
  lng: number | null;

  @ApiPropertyOptional({ description: 'Colonia / barrio', example: 'Centro' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string | null;
}
