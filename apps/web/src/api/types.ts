export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface RoleWithPermissions {
  name: string;
  permissions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  tenantId: string | null;
  roles: RoleWithPermissions[];
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  brand: string | null;
  unitOfMeasure: string;
  barcode: string | null;
  imageUrl: string | null;
  purchasePrice: number;
  salePrice: number;
  enabled: boolean;
  category: Category | null;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  active: boolean;
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  active: boolean;
}

export interface ProductStock {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
  averageCost: number;
  product: Product;
  warehouse: Warehouse;
}

export type MovementType = 'inbound' | 'outbound' | 'adjustment' | 'transfer' | 'return' | 'disposal';

export interface StockMovement {
  id: string;
  movementType: MovementType;
  productId: string;
  warehouseId: string;
  occurredAt: string;
  quantity: number;
  unitCost: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  product: Product;
  warehouse: Warehouse;
}

export interface Customer {
  id: string;
  code: string;
  tradeName: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  creditLimit: number;
  priceCategory: string | null;
  active: boolean;
}

export type InvoiceType = 'invoice' | 'credit_note';
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';

export interface Invoice {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customerId: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  notes: string | null;
  customer: Customer;
}

export interface DashboardReport {
  asOf: string;
  salesToday: number;
  salesMonth: number;
  monthInvoices: number;
  receivables: number;
  payables: number;
  inventoryValue: number;
  lowStockProducts: number;
  openPurchaseOrders: number;
  productionInProgress: number;
  netIncomeMonth: number;
}

export interface SalesSummaryRow {
  period: string;
  invoices: number;
  creditNotes: number;
  revenue: number;
  tax: number;
  total: number;
}

export interface SalesSummary {
  groupBy: string;
  data: SalesSummaryRow[];
  totals: {
    invoices: number;
    revenue: number;
    tax: number;
    total: number;
  };
}

export interface ProductSalesRow {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
}

export interface Supplier {
  id: string;
  code: string;
  tradeName: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  paymentTerms: string | null;
  creditLimit: number | null;
  active: boolean;
}

export type PurchaseOrderStatus = 'draft' | 'approved' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  description: string | null;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  receivedQuantity: number;
  discount: number;
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  warehouseId: string;
  issueDate: string;
  expectedAt: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  supplier: Supplier | null;
  warehouse: Warehouse | null;
  items: PurchaseOrderItem[];
}

export type SalesOrderKind = 'quote' | 'order';
export type SalesOrderStatus = 'draft' | 'confirmed' | 'invoiced' | 'cancelled';

export interface SalesOrderItem {
  id: string;
  productId: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  product?: Product;
}

export interface SalesOrder {
  id: string;
  number: string;
  kind: SalesOrderKind;
  status: SalesOrderStatus;
  customerId: string;
  warehouseId: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  version: number;
  customer: Customer | null;
  warehouse: Warehouse | null;
  items: SalesOrderItem[];
}

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  active: boolean;
}

export interface JournalEntryLine {
  id: string;
  entryId: string;
  accountId: string;
  lineIndex: number;
  description: string | null;
  debit: number;
  credit: number;
  account: ChartAccount | null;
}

export interface JournalEntry {
  id: string;
  number: string;
  periodId: string;
  entryDate: string;
  status: 'draft' | 'posted' | 'reversed';
  currency: string;
  description: string | null;
  debitTotal: number;
  creditTotal: number;
  lines: JournalEntryLine[];
}

export interface AccountingPeriod {
  id: string;
  period: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedBy: string | null;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  position: string | null;
  hireDate: string;
  terminationDate: string | null;
  salary: number;
  salaryFrequency: string;
  bankName: string | null;
  bankAccount: string | null;
  taxId: string | null;
  address: string | null;
  status: EmployeeStatus;
  department: Department | null;
}

export type PayrollStatus = 'draft' | 'posted' | 'cancelled';

export interface PayrollLine {
  id: string;
  payrollId: string;
  employeeId: string;
  gross: number;
  bonus: number;
  overtime: number;
  deductions: number;
  net: number;
  employee: Employee | null;
}

export interface Payroll {
  id: string;
  number: string;
  period: string;
  status: PayrollStatus;
  currency: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  paidAt: string | null;
  postedEntryId: string | null;
  postedAt: string | null;
  lines: PayrollLine[];
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  workedMinutes: number;
  status: AttendanceStatus;
  notes: string | null;
  employee?: Employee | null;
}

export type LeaveType = 'vacation' | 'sick' | 'personal' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Leave {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  employee?: Employee | null;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified' | 'converted';

export interface Lead {
  id: string;
  number: number;
  source: string | null;
  companyName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  estimatedAmount: number;
  currency: string;
  assignedUserId: string | null;
  notes: string | null;
  convertedCustomerId: string | null;
  convertedCustomer: Customer | null;
}

export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Opportunity {
  id: string;
  name: string;
  customerId: string | null;
  leadId: string | null;
  stage: OpportunityStage;
  amount: number;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  assignedUserId: string | null;
  wonAt: string | null;
  lostAt: string | null;
  notes: string | null;
  customer: Customer | null;
  lead: Lead | null;
}

export interface CrmContact {
  id: string;
  fullName: string;
  customerId: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  customer: Customer | null;
}

export type ActivityType = 'call' | 'meeting' | 'task' | 'note';

export interface CrmActivity {
  id: string;
  activityType: ActivityType;
  subject: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  referenceType: string | null;
  referenceId: string | null;
}

export type ProductionOrderStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ProductionBomLine {
  id: string;
  productId: string;
  quantity: number;
  wasteRate: number;
  product: Product | null;
}

export interface ProductionBom {
  id: string;
  name: string;
  productId: string;
  outputQuantity: number;
  active: boolean;
  product: Product;
  lines: ProductionBomLine[];
}

export interface ProductionOrderLine {
  id: string;
  productId: string;
  plannedQuantity: number;
  consumedQuantity: number;
  unitCost: number;
  lineCost: number;
  product: Product;
}

export interface ProductionOrder {
  id: string;
  number: string;
  productId: string;
  bomId: string | null;
  quantity: number;
  status: ProductionOrderStatus;
  warehouseId: string;
  currency: string;
  laborCost: number;
  overhead: number;
  materialCost: number;
  totalCost: number;
  completedAt: string | null;
  notes: string | null;
  product: Product;
  bom: ProductionBom | null;
  warehouse: Warehouse | null;
  lines: ProductionOrderLine[];
}
