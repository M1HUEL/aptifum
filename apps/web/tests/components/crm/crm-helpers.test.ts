import { describe, expect, it } from 'vitest';
import { activityTypes, leadStatusTone, stageTone, toLocalInput } from '../../../src/components/crm/crm-helpers';

describe('leadStatusTone', () => {
  it('maps converted to success', () => {
    expect(leadStatusTone('converted')).toBe('success');
  });

  it('maps disqualified to danger', () => {
    expect(leadStatusTone('disqualified')).toBe('danger');
  });

  it('maps qualified to info', () => {
    expect(leadStatusTone('qualified')).toBe('info');
  });

  it('defaults to neutral', () => {
    expect(leadStatusTone('new')).toBe('neutral');
    expect(leadStatusTone('contacted')).toBe('neutral');
  });
});

describe('stageTone', () => {
  it('maps won to success and lost to danger', () => {
    expect(stageTone('won')).toBe('success');
    expect(stageTone('lost')).toBe('danger');
  });

  it('maps proposal and negotiation to info', () => {
    expect(stageTone('proposal')).toBe('info');
    expect(stageTone('negotiation')).toBe('info');
  });

  it('defaults to neutral', () => {
    expect(stageTone('prospecting')).toBe('neutral');
    expect(stageTone('qualification')).toBe('neutral');
  });
});

describe('activityTypes', () => {
  it('exposes the expected activity types', () => {
    expect(activityTypes).toEqual(['call', 'meeting', 'task', 'note']);
  });
});

describe('toLocalInput', () => {
  it('returns an empty string for null or invalid input', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput('not-a-date')).toBe('');
  });

  it('converts an ISO date to local datetime-local format', () => {
    const iso = '2026-08-12T15:30:00.000Z';
    const result = toLocalInput(iso);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
