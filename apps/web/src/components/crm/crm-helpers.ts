import type { ActivityType, Lead, Opportunity } from '../../api/types';
import type { BadgeTone } from '../ui';

export const leadStatuses = ['new', 'contacted', 'qualified', 'disqualified', 'converted'] as const;
export const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'] as const;
export const activityTypes: ActivityType[] = ['call', 'meeting', 'task', 'note'];

export function leadStatusTone(status: Lead['status']): BadgeTone {
  if (status === 'converted') return 'success';
  if (status === 'disqualified') return 'danger';
  if (status === 'qualified') return 'info';
  return 'neutral';
}

export function stageTone(stage: Opportunity['stage']): BadgeTone {
  if (stage === 'won') return 'success';
  if (stage === 'lost') return 'danger';
  if (stage === 'negotiation' || stage === 'proposal') return 'info';
  return 'neutral';
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
