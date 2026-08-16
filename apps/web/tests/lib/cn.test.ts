import { describe, expect, it } from 'vitest';
import { cn } from '../../src/lib/cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('accepts conditional objects', () => {
    expect(cn({ active: true, hidden: false }, 'x')).toBe('active x');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('keeps non-conflicting classes', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });
});
