import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { RolePermission } from './role-permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  isActive: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  isSystem: number;

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

  @DeleteDateColumn({
    type: 'datetime',
    nullable: true,
    comment: 'Fecha de eliminación lógica (CST México)',
  })
  @Exclude()
  @ApiHideProperty()
  deletedAt: Date | null;

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions: RolePermission[];
}
