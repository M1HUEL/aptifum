import { describe, expect, it } from 'vitest';
import { customerFormSchema, productFormSchema, profileFormSchema } from './schemas';

describe('customerFormSchema', () => {
  it('accepts a minimal valid customer', () => {
    const result = customerFormSchema.safeParse({
      code: 'C-001',
      tradeName: 'Acme',
      legalName: '',
      taxId: '',
      email: '',
      phone: '',
      address: '',
      currency: 'USD',
      creditLimit: '',
      priceCategory: '',
      state: '',
      taxExempt: false,
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing code', () => {
    const result = customerFormSchema.safeParse({
      code: '   ',
      tradeName: 'Acme',
      currency: 'USD',
      creditLimit: '',
      state: '',
      taxExempt: false,
      active: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'code')).toBe(true);
    }
  });

  it('rejects an invalid email', () => {
    const result = customerFormSchema.safeParse({
      code: 'C-001',
      tradeName: 'Acme',
      email: 'not-an-email',
      currency: 'USD',
      creditLimit: '',
      state: '',
      taxExempt: false,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative credit limit', () => {
    const result = customerFormSchema.safeParse({
      code: 'C-001',
      tradeName: 'Acme',
      currency: 'USD',
      creditLimit: '-5',
      state: '',
      taxExempt: false,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts an invalid state value only when empty', () => {
    const base = {
      code: 'C-001',
      tradeName: 'Acme',
      legalName: '',
      taxId: '',
      email: '',
      phone: '',
      address: '',
      currency: 'USD',
      creditLimit: '',
      priceCategory: '',
      taxExempt: false,
      active: true,
    };
    const valid = customerFormSchema.safeParse({ ...base, state: 'CA' });
    expect(valid.success).toBe(true);

    const invalid = customerFormSchema.safeParse({ ...base, state: 'XX' });
    expect(invalid.success).toBe(false);
  });
});

describe('productFormSchema', () => {
  const base = {
    sku: 'SKU-1',
    name: 'Widget',
    description: '',
    brand: '',
    unitOfMeasure: 'pcs',
    barcode: '',
    categoryId: 'cat-1',
    purchasePrice: '',
    salePrice: '',
    enabled: true,
  };

  it('accepts a valid product', () => {
    expect(productFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = productFormSchema.safeParse({ ...base, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative sale price', () => {
    const result = productFormSchema.safeParse({ ...base, salePrice: '-1' });
    expect(result.success).toBe(false);
  });

  it('accepts a numeric sale price', () => {
    const result = productFormSchema.safeParse({ ...base, salePrice: '12.5' });
    expect(result.success).toBe(true);
  });
});

describe('profileFormSchema', () => {
  it('accepts a name-only update', () => {
    const result = profileFormSchema.safeParse({
      name: 'Ada',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = profileFormSchema.safeParse({
      name: 'Ada',
      currentPassword: 'old-pass',
      newPassword: 'new-password',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('requires the current password when changing the password', () => {
    const result = profileFormSchema.safeParse({
      name: 'Ada',
      currentPassword: '',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'currentPassword')).toBe(true);
    }
  });

  it('rejects a short new password', () => {
    const result = profileFormSchema.safeParse({
      name: 'Ada',
      currentPassword: 'old-pass',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});
