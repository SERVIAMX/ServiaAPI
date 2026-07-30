import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';

@Entity({ name: 'ProductImages' })
export class ProductImage {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'ServiceSKU' })
  serviceSku: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  serviceGroup: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  brand: string | null;
}
