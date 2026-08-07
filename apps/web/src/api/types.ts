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
