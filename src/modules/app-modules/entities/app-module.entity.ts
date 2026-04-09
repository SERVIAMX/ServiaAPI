import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Permission } from '../../roles/entities/permission.entity';

@Entity({ name: 'AppModules' })
export class AppModuleEntity {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  isActive: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({
    type: 'datetime',
    comment: 'Fecha de registro (CST México)',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'datetime',
    comment: 'Fecha de última actualización (CST México)',
  })
  updatedAt: Date;

  @OneToMany(() => Permission, (p) => p.module)
  permissions: Permission[];
}
