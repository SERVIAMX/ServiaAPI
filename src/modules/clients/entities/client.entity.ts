import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { CustomerBalance } from './customer-balance.entity';

@Entity({ name: 'Clients' })
export class Client {
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

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  creditLine: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  discountPercentage: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  commissionPercentage: string | null;

  @ApiPropertyOptional({
    description: 'Latitud del punto en mapa',
    example: 19.432608,
    nullable: true,
  })
  @Column({ type: 'double', nullable: true })
  lat: number | null;

  @ApiPropertyOptional({
    description: 'Longitud del punto en mapa',
    example: -99.133209,
    nullable: true,
  })
  @Column({ type: 'double', nullable: true })
  lng: number | null;

  @ApiPropertyOptional({
    description: 'Colonia / barrio',
    example: 'Centro',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood: string | null;

  @ApiPropertyOptional({
    type: () => CustomerBalance,
    description: 'Saldo del cliente (balance pagado y creditBalance)',
    nullable: true,
  })
  @OneToOne(() => CustomerBalance, (balance) => balance.customer)
  customerBalance?: CustomerBalance | null;
}
