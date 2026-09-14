import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Suscripción Web Push de un dispositivo (PWA).
 * Una fila = un navegador/dispositivo; varios por usuario/cliente.
 */
@Entity({ name: 'PushSubscriptions' })
export class PushSubscription {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  id: number;

  @Index('IX_PushSubscriptions_UserId')
  @Column({
    name: 'UserId',
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  userId: number;

  @Index('IX_PushSubscriptions_ClientId')
  @Column({
    name: 'ClientId',
    type: 'bigint',
    transformer: bigintTransformer,
  } as object)
  clientId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'UserId' })
  user: User;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'ClientId' })
  client: Client;

  @Column({ name: 'Endpoint', type: 'varchar', length: 500, unique: true })
  endpoint: string;

  @Column({ name: 'P256dh', type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ name: 'Auth', type: 'varchar', length: 255 })
  auth: string;

  @Column({
    name: 'TimeZone',
    type: 'varchar',
    length: 64,
    default: 'America/Mexico_City',
  })
  timeZone: string;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'LastSentAt', type: 'datetime', nullable: true })
  lastSentAt: Date | null;
}
