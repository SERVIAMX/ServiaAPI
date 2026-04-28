import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Client } from './client.entity';

@Entity({ name: 'BalanceHistory' })
export class BalanceHistory {
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
    precision: 10,
    scale: 2,
    nullable: true,
  })
  amount: string | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'FHRegistro',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date | null;

  /**
   * 1 = Pagado
   * 2 = Crédito
   */
  @Column({
    type: 'tinyint',
    nullable: true,
  })
  transactionType: number | null;

  @Column({
    type: 'tinyint',
    nullable: true,
  })
  isPaid: number | null;
}

