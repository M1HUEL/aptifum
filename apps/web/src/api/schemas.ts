import { z } from 'zod';
import * as core from '@aptifum/core';

const stateCodes = Object.keys(core.US_STATES) as [string, ...string[]];

export const customerFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(40, 'Code must be at most 40 characters'),
  tradeName: z.string().trim().min(1, 'Trade name is required').max(255, 'Trade name must be at most 255 characters'),
  legalName: z.string().trim().max(255, 'Legal name must be at most 255 characters'),
  taxId: z.string().trim().max(40, 'Tax ID must be at most 40 characters'),
  email: z
    .string()
    .trim()
    .max(190, 'Email must be at most 190 characters')
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Invalid email address'),
  phone: z.string().trim().max(40, 'Phone must be at most 40 characters'),
  address: z.string().trim().max(255, 'Address must be at most 255 characters'),
  currency: z.string().trim().max(3, 'Currency must be a 3-letter code'),
  creditLimit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Credit limit must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Credit limit cannot be negative'),
  priceCategory: z.string().trim().max(60, 'Price category must be at most 60 characters'),
  state: z.enum(stateCodes).or(z.literal('')),
  taxExempt: z.boolean(),
  active: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
