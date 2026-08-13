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

export const profileFormSchema = z
  .object({
    name: z.string().trim().max(255, 'Name must be at most 255 characters'),
    currentPassword: z.string(),
    newPassword: z.string().refine(
      (value) => value === '' || value.length >= 8,
      'New password must be at least 8 characters',
    ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword === '' || data.currentPassword.length > 0, {
    message: 'Current password is required to change the password.',
    path: ['currentPassword'],
  });

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const supplierFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(40, 'Code must be at most 40 characters'),
  tradeName: z
    .string()
    .trim()
    .min(1, 'Trade name is required')
    .max(255, 'Trade name must be at most 255 characters'),
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
  paymentTerms: z.string().trim().max(60, 'Payment terms must be at most 60 characters'),
  creditLimit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Credit limit must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Credit limit cannot be negative'),
  active: z.boolean(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export const accountFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(40, 'Code must be at most 40 characters'),
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalBalance: z.enum(['debit', 'credit']),
  parentId: z.string(),
  active: z.boolean(),
  description: z.string().trim().max(500, 'Description must be at most 500 characters'),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const productFormSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(60, 'SKU must be at most 60 characters'),
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be at most 255 characters'),
  description: z.string().trim(),
  brand: z.string().trim().max(120, 'Brand must be at most 120 characters'),
  unitOfMeasure: z.string().trim().max(20, 'Unit of measure must be at most 20 characters'),
  barcode: z.string().trim().max(64, 'Barcode must be at most 64 characters'),
  categoryId: z.string(),
  purchasePrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Purchase price must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Purchase price cannot be negative'),
  salePrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Sale price must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Sale price cannot be negative'),
  enabled: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const stockMovementFormSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  movementType: z.enum(['inbound', 'outbound', 'adjustment', 'transfer', 'return', 'disposal']),
  locationId: z.string(),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Quantity is required')
    .refine((value) => value !== '' && Number(value) > 0, 'Quantity must be greater than zero'),
  unitCost: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Unit cost must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Unit cost cannot be negative'),
  lotNumber: z.string().trim().max(80, 'Lot number must be at most 80 characters'),
  expiryDate: z.string(),
  notes: z.string().trim(),
});

export type StockMovementFormValues = z.infer<typeof stockMovementFormSchema>;

export const invoiceItemFormSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Quantity is required')
    .refine((value) => value !== '' && Number(value) > 0, 'Quantity must be greater than zero'),
  unitPrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Unit price must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Unit price cannot be negative'),
  taxRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Tax rate must be a number')
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      'Tax rate must be between 0 and 100',
    ),
});

export type InvoiceItemFormValues = z.infer<typeof invoiceItemFormSchema>;

export const invoiceFormSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer is required'),
  warehouseId: z.string(),
  dueDate: z.string(),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Discount must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Discount cannot be negative'),
  notes: z.string(),
  items: z.array(invoiceItemFormSchema).min(1, 'Add at least one line item.'),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const paymentFormSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'other']),
  amount: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Amount is required')
    .refine((value) => value !== '' && Number(value) > 0, 'Amount must be greater than zero'),
  receivedAt: z.string(),
  reference: z.string(),
  notes: z.string(),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const journalEntryLineFormSchema = z.object({
  accountCode: z.string(),
  debit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Debit must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Debit cannot be negative'),
  credit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Credit must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Credit cannot be negative'),
  description: z.string().trim().max(255, 'Memo must be at most 255 characters'),
});

export const journalEntryFormSchema = z.object({
  entryDate: z.string().min(1, 'Entry date is required'),
  description: z.string().trim().max(255, 'Description must be at most 255 characters'),
  lines: z.array(journalEntryLineFormSchema),
});

export type JournalEntryLineFormValues = z.infer<typeof journalEntryLineFormSchema>;
export type JournalEntryFormValues = z.infer<typeof journalEntryFormSchema>;

export const purchaseOrderItemFormSchema = z.object({
  productId: z.string(),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Quantity is required')
    .refine((value) => value !== '' && Number(value) > 0, 'Quantity must be greater than zero'),
  unitCost: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Unit cost must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Unit cost cannot be negative'),
  taxRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Tax rate must be a number')
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      'Tax rate must be between 0 and 100',
    ),
});

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  expectedAt: z.string(),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Discount must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Discount cannot be negative'),
  notes: z.string().trim().max(500, 'Notes must be at most 500 characters'),
  items: z.array(purchaseOrderItemFormSchema).min(1, 'Add at least one line item.'),
});

export type PurchaseOrderItemFormValues = z.infer<typeof purchaseOrderItemFormSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

export const purchaseReceiptItemFormSchema = z.object({
  orderItemId: z.string().min(1, 'Order item is required'),
  quantity: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Quantity must be a number'),
});

export const purchaseReceiptFormSchema = z.object({
  notes: z.string().trim().max(500, 'Notes must be at most 500 characters'),
  items: z.array(purchaseReceiptItemFormSchema),
});

export type PurchaseReceiptItemFormValues = z.infer<typeof purchaseReceiptItemFormSchema>;
export type PurchaseReceiptFormValues = z.infer<typeof purchaseReceiptFormSchema>;

export const salesOrderItemFormSchema = z.object({
  productId: z.string(),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), 'Quantity is required')
    .refine((value) => value !== '' && Number(value) > 0, 'Quantity must be greater than zero'),
  unitPrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Unit price must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Unit price cannot be negative'),
  taxRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Tax rate must be a number')
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      'Tax rate must be between 0 and 100',
    ),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Discount must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Discount cannot be negative'),
});

export const salesOrderFormSchema = z.object({
  kind: z.enum(['quote', 'order']),
  customerId: z.string().min(1, 'Customer is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  issueDate: z.string(),
  dueDate: z.string(),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Discount must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Discount cannot be negative'),
  notes: z.string().trim().max(500, 'Notes must be at most 500 characters'),
  items: z.array(salesOrderItemFormSchema).min(1, 'Add at least one line item.'),
});

export type SalesOrderItemFormValues = z.infer<typeof salesOrderItemFormSchema>;
export type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;

export const employeeFormSchema = z.object({
  employeeNo: z.string().trim().max(40, 'Employee no. must be at most 40 characters'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(255, 'First name must be at most 255 characters'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(255, 'Last name must be at most 255 characters'),
  email: z
    .string()
    .trim()
    .max(190, 'Email must be at most 190 characters')
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Invalid email address'),
  phone: z.string().trim().max(40, 'Phone must be at most 40 characters'),
  departmentId: z.string(),
  position: z.string().trim().max(120, 'Position must be at most 120 characters'),
  hireDate: z.string().min(1, 'Hire date is required'),
  salary: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Salary must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Salary cannot be negative'),
  salaryFrequency: z.string().trim().max(20, 'Salary frequency must be at most 20 characters'),
  status: z.enum(['active', 'inactive']),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const payrollLineInputFormSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  bonus: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Bonus must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Bonus cannot be negative'),
  overtime: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Overtime must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Overtime cannot be negative'),
  deductions: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), 'Deductions must be a number')
    .refine((value) => value === '' || Number(value) >= 0, 'Deductions cannot be negative'),
});

export const payrollFormSchema = z.object({
  period: z.string().min(1, 'Period is required'),
  lines: z.array(payrollLineInputFormSchema),
});

export type PayrollLineInputFormValues = z.infer<typeof payrollLineInputFormSchema>;
export type PayrollFormValues = z.infer<typeof payrollFormSchema>;
