import { describe, expect, it } from 'vitest';
import {
  GENERIC_RFC_FISICA,
  GENERIC_RFC_MORAL,
  normalizeRfc,
  validateEin,
  validateRfc,
} from '@aptifum/core';

describe('RFC validation', () => {
  it('accepts a valid persona moral RFC', () => {
    expect(validateRfc('XND160713M46')).toBe(true);
    expect(validateRfc('GAGZ8501012T1')).toBe(true);
  });

  it('accepts a valid persona física RFC with homoclave', () => {
    expect(validateRfc('AABJ860907HLA')).toBe(true);
    expect(validateRfc('HEOG720615HMC')).toBe(true);
  });

  it('accepts the generic SAT RFCs', () => {
    expect(validateRfc(GENERIC_RFC_FISICA)).toBe(true);
    expect(validateRfc(GENERIC_RFC_MORAL)).toBe(true);
  });

  it('is case-insensitive and ignores separators', () => {
    expect(validateRfc(' aabj860907hla ')).toBe(true);
    expect(validateRfc('XAXX-010101-000')).toBe(true);
  });

  it('rejects malformed RFCs', () => {
    expect(validateRfc('1234567890123')).toBe(false);
    expect(validateRfc('AABJ860907HLA3')).toBe(false);
    expect(validateRfc('AABJ000000HLA')).toBe(false);
    expect(validateRfc('')).toBe(false);
    expect(validateRfc('AABJ860907HLA!')).toBe(false);
  });
});

describe('EIN validation', () => {
  it('accepts 9-digit EINs', () => {
    expect(validateEin('123456789')).toBe(true);
    expect(validateEin('12-3456789')).toBe(true);
  });

  it('rejects malformed EINs', () => {
    expect(validateEin('12345678')).toBe(false);
    expect(validateEin('1234567890')).toBe(false);
    expect(validateEin('ABCDEFGHI')).toBe(false);
    expect(validateEin('')).toBe(false);
  });
});

describe('normalizeRfc', () => {
  it('normalizes case and strips separators', () => {
    expect(normalizeRfc(' aabj-860907 hla3 ')).toBe('AABJ860907HLA3');
  });
});
