import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';

@Entity('hr_departments')
@Unique(['tenantId', 'code'])
export class Department extends TenantBaseEntity {
  @Index()
  @Column({ length: 40 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'manager_employee_id', type: 'uuid', nullable: true })
  managerEmployeeId: string | null;

  @Column({ default: true })
  active: boolean;
}
