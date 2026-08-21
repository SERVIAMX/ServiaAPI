import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Type: 1 = Ingreso, 2 = Retiro
 */
@Entity({ name: 'MoneyTransactions' })
export class MoneyTransaction {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'Amount',
  })
  amount: string | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'CreatedAt',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date | null;

  /**
   * 1 = Ingreso
   * 2 = Retiro
   */
  @Column({
    type: 'tinyint',
    nullable: true,
    name: 'Type',
  })
  type: number | null;

  @Column({ type: 'text', nullable: true, name: 'VoucherUrl' })
  voucherUrl: string | null;

  @Column({ type: 'text', nullable: true, name: 'Comments' })
  comments: string | null;
}
