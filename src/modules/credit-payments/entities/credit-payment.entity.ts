import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { BalanceHistory } from '../../clients/entities/balance-history.entity';
import { ReferenceCode } from '../../references-codes/entities/reference-code.entity';

@Entity({ name: 'CreditPayments' })
export class CreditPayment {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @ManyToOne(() => BalanceHistory, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'IdHistoryBalance' })
  balanceHistory: BalanceHistory | null;

  @Column({ type: 'text', nullable: true })
  voucher: string | null;

  @ManyToOne(() => ReferenceCode, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'IdReferenceCode' })
  referenceCode: ReferenceCode | null;

  @CreateDateColumn({
    type: 'datetime',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date | null;
}
