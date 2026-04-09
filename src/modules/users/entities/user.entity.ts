import { ApiHideProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Client } from '../../clients/entities/client.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity({ name: 'Users' })
export class User {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'ClientId' })
  client: Client;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'RoleId' })
  role: Role;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  @ApiHideProperty()
  password: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  isActive: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  isVerified: number;

  @Column({
    type: 'datetime',
    nullable: true,
    comment: 'Último login (CST México)',
  })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  @ApiHideProperty()
  resetPasswordToken: string | null;

  @Column({
    type: 'datetime',
    nullable: true,
    comment: 'Expiración token reset (CST México)',
  })
  @Exclude()
  @ApiHideProperty()
  resetPasswordExpiresAt: Date | null;

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
}
