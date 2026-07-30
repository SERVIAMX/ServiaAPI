import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';

@Entity({ name: 'BrandImages' })
export class BrandImage {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  brand: string | null;
}
