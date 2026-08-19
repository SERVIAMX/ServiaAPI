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
import { Client } from '../../clients/entities/client.entity';

@Entity({ name: 'ReferencesCodes' })
export class ReferenceCode {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 8, nullable: true })
  code: string | null;

  @ManyToOne(() => Client, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'CustomerId' })
  customer: Client | null;

  @Column({
    type: 'tinyint',
    nullable: true,
    default: 1,
    transformer: tinyint01Transformer,
  })
  estatus: number | null;

  @CreateDateColumn({
    type: 'datetime',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date | null;

  @UpdateDateColumn({
    type: 'datetime',
    nullable: true,
  })
  updatedAt: Date | null;
}
