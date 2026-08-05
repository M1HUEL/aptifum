import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 190 })
  key: string;

  @Column({ name: 'request_hash', length: 64 })
  requestHash: string;

  @Column({ type: 'jsonb', nullable: true })
  response: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
