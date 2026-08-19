import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { tinyint01Transformer } from '../../../common/transformers/tinyint-01.transformer';
import { CustomerBalance } from '../../clients/entities/customer-balance.entity';

@Entity({ name: 'PendingAssignment' })
export class PendingAssignment {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @ManyToOne(() => CustomerBalance, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'CustomerId' })
  customerBalance: CustomerBalance | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  amount: string | null;

  @CreateDateColumn({
    type: 'datetime',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date | null;

  @Column({ type: 'text', nullable: true })
  voucherUrl: string | null;

  /** 1 = pendiente, 0 = procesado/aprobado */
  @Column({
    type: 'tinyint',
    name: 'PendingAssignment',
    nullable: true,
    default: 1,
    transformer: tinyint01Transformer,
  })
  estatus: number | null;
}
