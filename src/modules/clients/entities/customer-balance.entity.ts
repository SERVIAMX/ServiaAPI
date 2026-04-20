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
import { Client } from './client.entity';

@Entity({ name: 'CustomerBalance' })
export class CustomerBalance {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @ManyToOne(() => Client, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'CustomerId' })
  customer: Client | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  creditBalance: string;

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
}
