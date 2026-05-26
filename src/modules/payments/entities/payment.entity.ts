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
import { Client } from '../../clients/entities/client.entity';

@Entity({ name: 'Payments' })
export class Payment {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    unsigned: true,
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 500, name: 'OrderId' })
  orderId: string;

  @Column({ type: 'varchar', length: 500, unique: true, name: 'PaymentId' })
  paymentId: string;

  @Column({ type: 'varchar', length: 300, name: 'Status' })
  status: string;

  @Column({ type: 'varchar', length: 300, name: 'PaymentStatus' })
  paymentStatus: string;

  @Column({ type: 'varchar', length: 500, name: 'PaymentStatusDetail' })
  paymentStatusDetail: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'TotalAmount',
  })
  totalAmount: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'ExternalReference',
  })
  externalReference: string | null;

  @Column({
    type: 'bigint',
    unsigned: true,
    name: 'UserId',
    transformer: bigintTransformer,
  } as object)
  userId: number;

  @ManyToOne(() => Client, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'ClientId' })
  client: Client | null;

  @CreateDateColumn({ type: 'timestamp', name: 'FhRegistro' })
  fhRegistro: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'FhActualizacion' })
  fhActualizacion: Date;
}
