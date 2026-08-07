import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantBaseEntity } from '../base/tenant-base.entity';
import { numericTransformer } from '../base/transformers';
import { ChartAccount } from './chart-account.entity';
import { JournalEntry } from './journal-entry.entity';

@Entity('journal_entry_lines')
export class JournalEntryLine extends TenantBaseEntity {
  @Index('IDX_jel_entry_id')
  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @Index('IDX_jel_account_id')
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'line_index', type: 'int' })
  lineIndex: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  debit: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  credit: number;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines)
  @JoinColumn({ name: 'entry_id', foreignKeyConstraintName: 'FK_jel_entry' })
  entry: JournalEntry | null;

  @ManyToOne(() => ChartAccount)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_jel_account' })
  account: ChartAccount | null;
}
