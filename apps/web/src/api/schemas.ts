import { z } from 'zod';
import * as core from '@aptifum/core';
import i18n from '../i18n';

const stateCodes = Object.keys(core.US_STATES) as [string, ...string[]];

function f(key: string): string {
  return i18n.t(`fields.${key}`);
}

const val = {
  required: (fieldKey: string) => ({
    error: () => i18n.t('validation.required', { field: f(fieldKey) }),
  }),
  max: (fieldKey: string, max: number) => ({
    error: () => i18n.t('validation.maxChars', { field: f(fieldKey), max }),
  }),
  min: (fieldKey: string, min: number) => ({
    error: () => i18n.t('validation.minChars', { field: f(fieldKey), min }),
  }),
  number: (fieldKey: string) => ({
    error: () => i18n.t('validation.mustBeNumber', { field: f(fieldKey) }),
  }),
  notNegative: (fieldKey: string) => ({
    error: () => i18n.t('validation.cannotBeNegative', { field: f(fieldKey) }),
  }),
  greaterThanZero: (fieldKey: string) => ({
    error: () => i18n.t('validation.greaterThanZero', { field: f(fieldKey) }),
  }),
  between0And100: (fieldKey: string) => ({
    error: () => i18n.t('validation.between0And100', { field: f(fieldKey) }),
  }),
  threeLetterCode: (fieldKey: string) => ({
    error: () => i18n.t('validation.threeLetterCode', { field: f(fieldKey) }),
  }),
  invalidEmail: { error: () => i18n.t('validation.invalidEmail') },
  atLeastOneLineItem: { error: () => i18n.t('validation.atLeastOneLineItem') },
};

export const customerFormSchema = z.object({
  code: z.string().trim().min(1, val.required('code')).max(40, val.max('code', 40)),
  tradeName: z.string().trim().min(1, val.required('tradeName')).max(255, val.max('tradeName', 255)),
  legalName: z.string().trim().max(255, val.max('legalName', 255)),
  taxId: z.string().trim().max(40, val.max('taxId', 40)),
  email: z
    .string()
    .trim()
    .max(190, val.max('email', 190))
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), val.invalidEmail),
  phone: z.string().trim().max(40, val.max('phone', 40)),
  address: z.string().trim().max(255, val.max('address', 255)),
  currency: z.string().trim().max(3, val.threeLetterCode('currency')),
  creditLimit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('creditLimit'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('creditLimit')),
  priceCategory: z.string().trim().max(60, val.max('priceCategory', 60)),
  state: z.enum(stateCodes).or(z.literal('')),
  taxExempt: z.boolean(),
  active: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const profileFormSchema = z
  .object({
    name: z.string().trim().max(255, val.max('name', 255)),
    currentPassword: z.string(),
    newPassword: z.string().refine(
      (value) => value === '' || value.length >= 8,
      val.min('newPassword', 8),
    ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: () => i18n.t('validation.newPasswordMismatch'),
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword === '' || data.currentPassword.length > 0, {
    error: () => i18n.t('validation.currentPasswordRequired'),
    path: ['currentPassword'],
  });

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const supplierFormSchema = z.object({
  code: z.string().trim().min(1, val.required('code')).max(40, val.max('code', 40)),
  tradeName: z
    .string()
    .trim()
    .min(1, val.required('tradeName'))
    .max(255, val.max('tradeName', 255)),
  legalName: z.string().trim().max(255, val.max('legalName', 255)),
  taxId: z.string().trim().max(40, val.max('taxId', 40)),
  email: z
    .string()
    .trim()
    .max(190, val.max('email', 190))
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), val.invalidEmail),
  phone: z.string().trim().max(40, val.max('phone', 40)),
  address: z.string().trim().max(255, val.max('address', 255)),
  currency: z.string().trim().max(3, val.threeLetterCode('currency')),
  paymentTerms: z.string().trim().max(60, val.max('paymentTerms', 60)),
  creditLimit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('creditLimit'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('creditLimit')),
  active: z.boolean(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export const accountFormSchema = z.object({
  code: z.string().trim().min(1, val.required('code')).max(40, val.max('code', 40)),
  name: z.string().trim().min(1, val.required('name')).max(255, val.max('name', 255)),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalBalance: z.enum(['debit', 'credit']),
  parentId: z.string(),
  active: z.boolean(),
  description: z.string().trim().max(500, val.max('description', 500)),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const productFormSchema = z.object({
  sku: z.string().trim().min(1, val.required('sku')).max(60, val.max('sku', 60)),
  name: z.string().trim().min(1, val.required('name')).max(255, val.max('name', 255)),
  description: z.string().trim(),
  brand: z.string().trim().max(120, val.max('brand', 120)),
  unitOfMeasure: z.string().trim().max(20, val.max('unitOfMeasure', 20)),
  barcode: z.string().trim().max(64, val.max('barcode', 64)),
  categoryId: z.string(),
  purchasePrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('purchasePrice'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('purchasePrice')),
  salePrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('salePrice'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('salePrice')),
  enabled: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const stockMovementFormSchema = z.object({
  productId: z.string().min(1, val.required('product')),
  warehouseId: z.string().min(1, val.required('warehouse')),
  movementType: z.enum(['inbound', 'outbound', 'adjustment', 'transfer', 'return', 'disposal']),
  locationId: z.string(),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), val.required('quantity'))
    .refine((value) => value !== '' && Number(value) > 0, val.greaterThanZero('quantity')),
  unitCost: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('unitCost'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('unitCost')),
  lotNumber: z.string().trim().max(80, val.max('lotNumber', 80)),
  expiryDate: z.string(),
  notes: z.string().trim(),
});

export type StockMovementFormValues = z.infer<typeof stockMovementFormSchema>;

export const invoiceItemFormSchema = z.object({
  productId: z.string().min(1, val.required('product')),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), val.required('quantity'))
    .refine((value) => value !== '' && Number(value) > 0, val.greaterThanZero('quantity')),
  unitPrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('unitPrice'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('unitPrice')),
  taxRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('taxRate'))
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      val.between0And100('taxRate'),
    ),
});

export type InvoiceItemFormValues = z.infer<typeof invoiceItemFormSchema>;

export const invoiceFormSchema = z.object({
  customerId: z.string().trim().min(1, val.required('customer')),
  warehouseId: z.string(),
  dueDate: z.string(),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('discount'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('discount')),
  notes: z.string(),
  items: z.array(invoiceItemFormSchema).min(1, val.atLeastOneLineItem),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const paymentFormSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'other']),
  amount: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), val.required('amount'))
    .refine((value) => value !== '' && Number(value) > 0, val.greaterThanZero('amount')),
  receivedAt: z.string(),
  reference: z.string(),
  notes: z.string(),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const journalEntryLineFormSchema = z.object({
  accountCode: z.string(),
  debit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('debit'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('debit')),
  credit: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('credit'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('credit')),
  description: z.string().trim().max(255, val.max('memo', 255)),
});

export const journalEntryFormSchema = z.object({
  entryDate: z.string().min(1, val.required('entryDate')),
  description: z.string().trim().max(255, val.max('description', 255)),
  lines: z.array(journalEntryLineFormSchema),
});

export type JournalEntryLineFormValues = z.infer<typeof journalEntryLineFormSchema>;
export type JournalEntryFormValues = z.infer<typeof journalEntryFormSchema>;

export const purchaseOrderItemFormSchema = z.object({
  productId: z.string(),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), val.required('quantity'))
    .refine((value) => value !== '' && Number(value) > 0, val.greaterThanZero('quantity')),
  unitCost: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('unitCost'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('unitCost')),
  taxRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('taxRate'))
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      val.between0And100('taxRate'),
    ),
});

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().min(1, val.required('supplier')),
  warehouseId: z.string().min(1, val.required('warehouse')),
  expectedAt: z.string(),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('discount'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('discount')),
  notes: z.string().trim().max(500, val.max('notes', 500)),
  items: z.array(purchaseOrderItemFormSchema).min(1, val.atLeastOneLineItem),
});

export type PurchaseOrderItemFormValues = z.infer<typeof purchaseOrderItemFormSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

export const purchaseReceiptItemFormSchema = z.object({
  orderItemId: z.string().min(1, val.required('orderItem')),
  quantity: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('quantity')),
});

export const purchaseReceiptFormSchema = z.object({
  notes: z.string().trim().max(500, val.max('notes', 500)),
  items: z.array(purchaseReceiptItemFormSchema),
});

export type PurchaseReceiptItemFormValues = z.infer<typeof purchaseReceiptItemFormSchema>;
export type PurchaseReceiptFormValues = z.infer<typeof purchaseReceiptFormSchema>;

export const salesOrderItemFormSchema = z.object({
  productId: z.string(),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), val.required('quantity'))
    .refine((value) => value !== '' && Number(value) > 0, val.greaterThanZero('quantity')),
  unitPrice: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('unitPrice'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('unitPrice')),
  taxRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('taxRate'))
    .refine(
      (value) => value === '' || (Number(value) >= 0 && Number(value) <= 100),
      val.between0And100('taxRate'),
    ),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('discount'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('discount')),
});

export const salesOrderFormSchema = z.object({
  kind: z.enum(['quote', 'order']),
  customerId: z.string().min(1, val.required('customer')),
  warehouseId: z.string().min(1, val.required('warehouse')),
  issueDate: z.string(),
  dueDate: z.string(),
  discount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('discount'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('discount')),
  notes: z.string().trim().max(500, val.max('notes', 500)),
  items: z.array(salesOrderItemFormSchema).min(1, val.atLeastOneLineItem),
});

export type SalesOrderItemFormValues = z.infer<typeof salesOrderItemFormSchema>;
export type SalesOrderFormValues = z.infer<typeof salesOrderFormSchema>;

export const employeeFormSchema = z.object({
  employeeNo: z.string().trim().max(40, val.max('employeeNo', 40)),
  firstName: z
    .string()
    .trim()
    .min(1, val.required('firstName'))
    .max(255, val.max('firstName', 255)),
  lastName: z
    .string()
    .trim()
    .min(1, val.required('lastName'))
    .max(255, val.max('lastName', 255)),
  email: z
    .string()
    .trim()
    .max(190, val.max('email', 190))
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), val.invalidEmail),
  phone: z.string().trim().max(40, val.max('phone', 40)),
  departmentId: z.string(),
  position: z.string().trim().max(120, val.max('position', 120)),
  hireDate: z.string().min(1, val.required('hireDate')),
  salary: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('salary'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('salary')),
  salaryFrequency: z.string().trim().max(20, val.max('salaryFrequency', 20)),
  status: z.enum(['active', 'inactive']),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const payrollLineInputFormSchema = z.object({
  employeeId: z.string().min(1, val.required('employee')),
  bonus: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('bonus'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('bonus')),
  overtime: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('overtime'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('overtime')),
  deductions: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('deductions'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('deductions')),
});

export const payrollFormSchema = z.object({
  period: z.string().min(1, val.required('period')),
  lines: z.array(payrollLineInputFormSchema),
});

export type PayrollLineInputFormValues = z.infer<typeof payrollLineInputFormSchema>;
export type PayrollFormValues = z.infer<typeof payrollFormSchema>;

export const warehouseFormSchema = z.object({
  code: z.string().trim().min(1, val.required('code')).max(60, val.max('code', 60)),
  name: z.string().trim().min(1, val.required('name')).max(255, val.max('name', 255)),
  address: z.string().trim().max(255, val.max('address', 255)),
  active: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export const locationFormSchema = z.object({
  code: z.string().trim().min(1, val.required('code')).max(60, val.max('code', 60)),
  name: z.string().trim().min(1, val.required('name')).max(255, val.max('name', 255)),
  active: z.boolean(),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, val.required('name')).max(255, val.max('name', 255)),
  parentId: z.string(),
  active: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const userFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, val.required('email'))
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), val.invalidEmail),
  name: z.string().trim().max(255, val.max('name', 255)),
  password: z.string().refine(
    (value) => value === '' || value.length >= 8,
    val.min('password', 8),
  ),
  active: z.boolean(),
  roleIds: z.array(z.string()),
  invite: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(1, val.required('name')).max(60, val.max('name', 60)),
  description: z.string().trim().max(255, val.max('description', 255)),
  permissions: z.array(z.string()),
});

export type RoleFormValues = z.infer<typeof roleFormSchema>;

export const bomLineFormSchema = z.object({
  productId: z.string(),
  quantity: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('quantity')),
  wasteRate: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('wasteRate')),
});

export type BomLineFormValues = z.infer<typeof bomLineFormSchema>;

export const bomFormSchema = z.object({
  name: z.string().trim().min(1, val.required('name')).max(255, val.max('name', 255)),
  productId: z.string().min(1, val.required('finishedProduct')),
  outputQuantity: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('outputQuantity')),
  active: z.boolean(),
  lines: z.array(bomLineFormSchema),
});

export type BomFormValues = z.infer<typeof bomFormSchema>;

export const productionOrderFormSchema = z.object({
  productId: z.string().min(1, val.required('product')),
  bomId: z.string(),
  warehouseId: z.string().min(1, val.required('warehouse')),
  quantity: z
    .string()
    .refine((value) => value !== '' && !Number.isNaN(Number(value)), val.required('quantity'))
    .refine((value) => value !== '' && Number(value) > 0, val.greaterThanZero('quantity')),
  laborCost: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('laborCost'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('laborCost')),
  overhead: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('overhead'))
    .refine((value) => value === '' || Number(value) >= 0, val.notNegative('overhead')),
  notes: z.string().trim().max(500, val.max('notes', 500)),
});

export type ProductionOrderFormValues = z.infer<typeof productionOrderFormSchema>;

export const clockFormSchema = z.object({
  employeeId: z.string().min(1, { error: () => i18n.t('validation.selectEmployee') }),
  action: z.enum(['in', 'out']),
  at: z.string(),
});

export type ClockFormValues = z.infer<typeof clockFormSchema>;

export const attendanceFormSchema = z.object({
  employeeId: z.string().min(1, val.required('employee')),
  workDate: z.string().min(1, val.required('workDate')),
  clockInAt: z.string(),
  clockOutAt: z.string(),
  status: z.enum(['present', 'late', 'absent', 'leave']),
  notes: z.string().trim().max(500, val.max('notes', 500)),
});

export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

export const leaveFormSchema = z.object({
  employeeId: z.string().min(1, val.required('employee')),
  leaveType: z.enum(['vacation', 'sick', 'personal', 'other']),
  startDate: z.string().min(1, val.required('startDate')),
  endDate: z.string().min(1, val.required('endDate')),
  days: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('days'))
    .refine((value) => value === '' || Number(value) >= 1, {
      error: () => i18n.t('validation.daysAtLeast1'),
    }),
  reason: z.string().trim().max(500, val.max('reason', 500)),
});

export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

export const activityFormSchema = z.object({
  activityType: z.enum(['call', 'meeting', 'task', 'note']),
  subject: z.string().trim().min(1, { error: () => i18n.t('validation.subjectRequired') }),
  description: z.string(),
  dueAt: z.string(),
  completedAt: z.string(),
  referenceType: z.string(),
  referenceId: z.string(),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export const contactFormSchema = z.object({
  fullName: z.string().trim().min(1, { error: () => i18n.t('validation.fullNameRequired') }),
  customerId: z.string(),
  title: z.string(),
  email: z.string(),
  phone: z.string(),
  mobile: z.string(),
  address: z.string(),
  notes: z.string(),
  active: z.boolean(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const leadFormSchema = z.object({
  source: z.string(),
  companyName: z.string(),
  contactName: z.string().trim().min(1, { error: () => i18n.t('validation.contactNameRequired') }),
  email: z.string(),
  phone: z.string(),
  status: z.enum(['new', 'contacted', 'qualified', 'disqualified', 'converted']),
  estimatedAmount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('estimatedAmount')),
  currency: z.string().trim().max(3, val.max('currency', 3)),
  notes: z.string(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const opportunityFormSchema = z.object({
  name: z.string().trim().min(1, val.required('name')),
  customerId: z.string(),
  stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost']),
  amount: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('amount')),
  currency: z.string().trim().max(3, val.max('currency', 3)),
  probability: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(Number(value)), val.number('probability')),
  expectedCloseDate: z.string(),
  notes: z.string(),
});

export type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;
