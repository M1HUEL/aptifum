import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { JournalEntryStatus } from '@aptifum/core';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { AccountingPeriod } from './accounting-period.entity';
import { JournalEntryLine } from './journal-entry-line.entity';

@Entity('journal_entries')
@Unique(['tenantId', 'number'])
export class JournalEntry extends TenantBaseEntity {
  @Index()
  @Column({ length: 30 })
  number: string;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  @Column({
    type: 'enum',
    enum: JournalEntryStatus,
    default: JournalEntryStatus.POSTED,
  })
  status: JournalEntryStatus;

  @Column({ name: 'reference_type', type: 'varchar', length: 120, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'debit_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  debitTotal: number;

  @Column({
    name: 'credit_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  creditTotal: number;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'posted_by', type: 'uuid', nullable: true })
  postedBy: string | null;

  @Column({ name: 'reversed_by_entry_id', type: 'uuid', nullable: true })
  reversedByEntryId: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => AccountingPeriod)
  @JoinColumn({ name: 'period_id' })
  period: AccountingPeriod | null;

  @OneToMany(() => JournalEntryLine, (line) => line.entry, { cascade: true })
  lines: JournalEntryLine[];
}
