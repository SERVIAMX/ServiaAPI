import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { tinyint01Transformer } from '../../../common/transformers/tinyint-01.transformer';
import { Client } from '../../clients/entities/client.entity';

@Entity({ name: 'FavoritesBrands' })
export class FavoriteBrand {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 400, nullable: true })
  brand: string | null;

  @ManyToOne(() => Client, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'IdCliente' })
  client: Client | null;

  @Column({
    type: 'tinyint',
    nullable: true,
    default: 1,
    transformer: tinyint01Transformer,
  })
  estatus: number | null;
}
