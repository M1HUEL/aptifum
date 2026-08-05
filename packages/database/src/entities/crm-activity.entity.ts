import { Column, Entity, Index } from 'typeorm';
import { ActivityType } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';

@Entity('crm_activities')
export class CrmActivity extends TenantBaseEntity {
  @Column({
    name: 'activity_type',
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @Index()
  @Column({ name: 'reference_type', type: 'varchar', length: 120, nullable: true })
  referenceType: string | null;

  @Index()
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;
}
