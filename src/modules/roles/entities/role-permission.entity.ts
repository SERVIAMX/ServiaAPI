import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Entity({ name: 'RolePermissions' })
export class RolePermission {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @ManyToOne(() => Role, (r) => r.rolePermissions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'RoleId' })
  role: Role;

  @ManyToOne(() => Permission, (p) => p.rolePermissions, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'PermissionId' })
  permission: Permission;

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
}
