import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';

/**
 * Type: 1 = Tiempo_aire, 2 = Servicios
 */
@Entity({ name: 'SupplierPurchases' })
export class SupplierPurchase {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  amount: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  amountReceived: string | null;

  /**
   * 1 = Tiempo_aire
   * 2 = Servicios
   */
  @Column({
    type: 'tinyint',
    nullable: true,
  })
  type: number | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'FHRegistro',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date | null;
}
