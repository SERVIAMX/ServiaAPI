import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Saldo único de banco (fila `Id = 1`). */
@Entity({ name: 'Bank' })
export class Bank {
  @PrimaryColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'Amount',
  })
  amount: string | null;
}
