import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'OperationAuditLog' })
export class OperationAuditLog {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'Id',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @CreateDateColumn({ type: 'timestamp', name: 'FHRegister' })
  fhRegister: Date;

  @Column({ type: 'varchar', length: 40, name: 'OperationType' })
  operationType: string;

  @Column({ type: 'varchar', length: 20, name: 'Status' })
  status: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ClientId' })
  @Exclude()
  @ApiHideProperty()
  client: Client | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'UserId' })
  @Exclude()
  @ApiHideProperty()
  user: User | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'ReferenceId' })
  referenceId: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'Amount',
  })
  amount: string | null;

  @Column({ type: 'json', nullable: true, name: 'RequestPayload' })
  requestPayload: unknown | null;

  @Column({ type: 'json', nullable: true, name: 'ResponsePayload' })
  responsePayload: unknown | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'Message' })
  message: string | null;
}
