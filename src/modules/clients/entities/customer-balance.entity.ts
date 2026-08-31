import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Client } from './client.entity';

@Entity({ name: 'CustomerBalance' })
export class CustomerBalance {
  @ApiProperty()
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @OneToOne(() => Client, (client) => client.customerBalance, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'CustomerId' })
  @Exclude()
  @ApiHideProperty()
  customer: Client | null;

  @ApiProperty({
    description: 'Saldo de crédito acreditado (financiado)',
    example: '1000.00',
  })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  creditBalance: string;

  @ApiProperty({
    description: 'Saldo pagado acreditado',
    example: '500.00',
  })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  balance: string;

  @ApiProperty()
  @CreateDateColumn({
    type: 'datetime',
    comment: 'Fecha de registro (CST México)',
  })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({
    type: 'datetime',
    comment: 'Fecha de última actualización (CST México)',
  })
  updatedAt: Date;
}
