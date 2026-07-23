import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { tinyint01Transformer } from '../../../common/transformers/tinyint-01.transformer';
import { User } from '../../users/entities/user.entity';

export function recargaEstadoFromCode(
  code: string | null | undefined,
): 'exitosa' | 'fallida' | 'pendiente' {
  const c = String(code ?? '').trim();
  if (c === '') return 'pendiente';
  if (c === '0' || Number(c) === 0) return 'exitosa';
  return 'fallida';
}

@Entity({ name: 'Transactions' })
export class Transaction {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'IdTransaction',
    transformer: bigintTransformer,
  } as object)
  idTransaction: number;

  @CreateDateColumn({ type: 'timestamp', name: 'FHRegister' })
  fhRegister: Date;

  @Column({ type: 'varchar', length: 20, name: 'ExternalId' })
  externalId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'IdUser' })
  @Exclude()
  @ApiHideProperty()
  user: User;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: '0.00',
    name: 'Amount',
  })
  amount: string;

  /** Código proveedor: 0 = recarga exitosa; distinto de 0 = fallida. */
  @Column({ type: 'varchar', length: 5, default: '', name: 'Code' })
  code: string;

  @Column({ type: 'varchar', length: 50, name: 'SKU' })
  sku: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'Logo' })
  logo: string | null;

  @UpdateDateColumn({ type: 'timestamp', name: 'FHUpdate' })
  fhUpdate: Date;

  /** Segundos que tardó la venta en Movivendor. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'VentaDurationSeconds',
  })
  ventaDurationSeconds: string | null;

  /** Momento en que respondió el último check-status. */
  @Column({ type: 'timestamp', nullable: true, name: 'FHCheckStatus' })
  fhCheckStatus: Date | null;

  @Column({ type: 'json', nullable: true, name: 'ResponseProvider' })
  @Exclude()
  @ApiHideProperty()
  responseProvider: unknown | null;

  /** 0 = Pagado (Balance), 1 = Crédito (CreditBalance). */
  @Column({
    type: 'tinyint',
    nullable: true,
    name: 'IsCredit',
    transformer: tinyint01Transformer,
  })
  isCredit: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'NetAmount',
  })
  netAmount: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'Destination' })
  destination: string | null;

  @Column({ type: 'varchar', length: 90, nullable: true, name: 'Brand' })
  brand: string | null;

  /** 1 = tiempo aire (tipo `tiempo_aire`), 0 = otro. */
  @Column({
    type: 'tinyint',
    nullable: true,
    name: 'EsTAE',
    transformer: tinyint01Transformer,
  })
  esTAE: number | null;
}

