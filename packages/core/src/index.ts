export enum ModuleName {
  AUTH = 'auth',
  USERS = 'users',
  RBAC = 'rbac',
  TENANTS = 'tenants',
  INVENTORY = 'inventory',
  SALES = 'sales',
  INVOICING = 'invoicing',
  PURCHASING = 'purchasing',
  ACCOUNTING = 'accounting',
  HR = 'hr',
  CRM = 'crm',
  PRODUCTION = 'production',
  REPORTING = 'reporting',
  AUDIT = 'audit',
  PAYMENTS = 'payments',
  TAX = 'tax',
}

export type PermissionAction = 'read' | 'write' | 'approve' | 'adjust' | 'delete';

export const ALL_PERMISSIONS = '*';

export const permission = (module: ModuleName, action: PermissionAction): string =>
  `${module}:${action}`;

export type Permission = string;

export enum RoleName {
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  SELLER = 'seller',
  WAREHOUSE = 'warehouse',
  HR = 'hr',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
}

export enum MovementType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  RETURN = 'return',
  DISPOSAL = 'disposal',
}

export enum SalesOrderKind {
  QUOTE = 'quote',
  ORDER = 'order',
}

export enum SalesOrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  INVOICED = 'invoiced',
  CANCELLED = 'cancelled',
}

export enum InvoiceType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  OTHER = 'other',
}

export type PaymentProvider = 'stripe';

export type PaymentProviderEnvironment = 'test' | 'live';

export enum TaxKind {
  SALES = 'sales',
  PURCHASE = 'purchase',
}

export enum DocumentSeriesKind {
  QUOTE = 'quote',
  ORDER = 'order',
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  PURCHASE_ORDER = 'purchase_order',
  GOODS_RECEIPT = 'goods_receipt',
  SUPPLIER_BILL = 'supplier_bill',
  JOURNAL_ENTRY = 'journal_entry',
  LEAD = 'lead',
  PAYROLL = 'payroll',
  PRODUCTION_ORDER = 'production_order',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export enum SupplierBillStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export enum AccountNormalBalance {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum AccountingPeriodStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  REVERSED = 'reversed',
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  DISQUALIFIED = 'disqualified',
  CONVERTED = 'converted',
}

export enum OpportunityStage {
  PROSPECTING = 'prospecting',
  QUALIFICATION = 'qualification',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

export enum ActivityType {
  CALL = 'call',
  MEETING = 'meeting',
  TASK = 'task',
  NOTE = 'note',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  LEAVE = 'leave',
}

export enum LeaveType {
  VACATION = 'vacation',
  SICK = 'sick',
  PERSONAL = 'personal',
  OTHER = 'other',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum PayrollStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  CANCELLED = 'cancelled',
}

export enum ProductionOrderStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CfdiStatus {
  PENDING = 'pending',
  STAMPED = 'stamped',
  CANCELLED = 'cancelled',
}

export interface FiscalAddress {
  street: string;
  exterior?: string;
  interior?: string;
  zip: string;
  city?: string;
  municipality?: string;
  state?: string;
}

export const GENERIC_RFC_FISICA = 'XAXX010101000';
export const GENERIC_RFC_MORAL = 'XEXX010101000';

export function normalizeRfc(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s.\-]/g, '')
    .trim();
}

/**
 * Validates a Mexican RFC (persona física 13 chars / persona moral 12 chars).
 * Accepts the generic SAT RFCs (XAXX010101000 / XEXX010101000) used for
 * receipts without an RFC. Checks shape, date portion and homoclave charset.
 */
export function validateRfc(value: string): boolean {
  const rfc = normalizeRfc(value);
  if (rfc === GENERIC_RFC_FISICA || rfc === GENERIC_RFC_MORAL) {
    return true;
  }
  if (rfc.length !== 12 && rfc.length !== 13) {
    return false;
  }
  const isMoral = rfc.length === 12;
  const head = rfc.slice(0, isMoral ? 3 : 4);
  if (!/^[A-ZÑ&]/.test(head) || !new RegExp(`^[A-ZÑ&]{${head.length}}$`).test(head)) {
    return false;
  }
  const date = rfc.slice(isMoral ? 3 : 4, isMoral ? 9 : 10);
  if (!/^\d{6}$/.test(date)) {
    return false;
  }
  const year = Number(date.slice(0, 2));
  const month = Number(date.slice(2, 4));
  const day = Number(date.slice(4, 6));
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDays = new Date(2000 + year, month, 0).getDate();
  if (day < 1 || day > maxDays) {
    return false;
  }
  const homoclave = rfc.slice(isMoral ? 9 : 10);
  if (!/^[0-9A-Z]{3}$/.test(homoclave)) {
    return false;
  }
  return true;
}

/**
 * Validates a US EIN: 9 digits, optionally formatted XX-XXXXXXX.
 */
export function validateEin(value: string): boolean {
  const ein = value.replace(/[\s\-]/g, '');
  return /^\d{9}$/.test(ein);
}

/**
 * US states with their base state-level sales tax rate (fraction).
 * Local/combined rates vary by jurisdiction; tenants can override each
 * state's rate in their US sales tax configuration.
 */
export const US_STATES: Record<string, { name: string; rate: number }> = {
  AL: { name: 'Alabama', rate: 0.04 },
  AK: { name: 'Alaska', rate: 0 },
  AZ: { name: 'Arizona', rate: 0.056 },
  AR: { name: 'Arkansas', rate: 0.065 },
  CA: { name: 'California', rate: 0.0725 },
  CO: { name: 'Colorado', rate: 0.029 },
  CT: { name: 'Connecticut', rate: 0.0635 },
  DE: { name: 'Delaware', rate: 0 },
  DC: { name: 'District of Columbia', rate: 0.06 },
  FL: { name: 'Florida', rate: 0.06 },
  GA: { name: 'Georgia', rate: 0.04 },
  HI: { name: 'Hawaii', rate: 0.04 },
  ID: { name: 'Idaho', rate: 0.06 },
  IL: { name: 'Illinois', rate: 0.0625 },
  IN: { name: 'Indiana', rate: 0.07 },
  IA: { name: 'Iowa', rate: 0.06 },
  KS: { name: 'Kansas', rate: 0.065 },
  KY: { name: 'Kentucky', rate: 0.06 },
  LA: { name: 'Louisiana', rate: 0.0445 },
  ME: { name: 'Maine', rate: 0.055 },
  MD: { name: 'Maryland', rate: 0.06 },
  MA: { name: 'Massachusetts', rate: 0.0625 },
  MI: { name: 'Michigan', rate: 0.06 },
  MN: { name: 'Minnesota', rate: 0.06875 },
  MS: { name: 'Mississippi', rate: 0.07 },
  MO: { name: 'Missouri', rate: 0.04225 },
  MT: { name: 'Montana', rate: 0 },
  NE: { name: 'Nebraska', rate: 0.055 },
  NV: { name: 'Nevada', rate: 0.0685 },
  NH: { name: 'New Hampshire', rate: 0 },
  NJ: { name: 'New Jersey', rate: 0.06625 },
  NM: { name: 'New Mexico', rate: 0.04875 },
  NY: { name: 'New York', rate: 0.04 },
  NC: { name: 'North Carolina', rate: 0.0475 },
  ND: { name: 'North Dakota', rate: 0.05 },
  OH: { name: 'Ohio', rate: 0.0575 },
  OK: { name: 'Oklahoma', rate: 0.045 },
  OR: { name: 'Oregon', rate: 0 },
  PA: { name: 'Pennsylvania', rate: 0.06 },
  RI: { name: 'Rhode Island', rate: 0.07 },
  SC: { name: 'South Carolina', rate: 0.06 },
  SD: { name: 'South Dakota', rate: 0.045 },
  TN: { name: 'Tennessee', rate: 0.07 },
  TX: { name: 'Texas', rate: 0.0625 },
  UT: { name: 'Utah', rate: 0.0485 },
  VT: { name: 'Vermont', rate: 0.06 },
  VA: { name: 'Virginia', rate: 0.053 },
  WA: { name: 'Washington', rate: 0.065 },
  WV: { name: 'West Virginia', rate: 0.06 },
  WI: { name: 'Wisconsin', rate: 0.05 },
  WY: { name: 'Wyoming', rate: 0.04 },
};

export interface UsSalesTaxConfig {
  /** States where the seller has nexus and must collect sales tax. */
  nexusStates: string[];
  /** Optional per-state rate overrides (fraction), keyed by state code. */
  rates?: Record<string, number>;
}

/**
 * Resolves the US sales tax rate for a sale to `customerState` given the
 * tenant's nexus configuration. Returns 0 when the customer is tax-exempt,
 * has no state, the seller has no nexus there, or the state is unknown.
 * Overrides in `config.rates` win over the state default.
 */
export function resolveUsSalesTaxRate(
  config: UsSalesTaxConfig | null | undefined,
  customerState: string | null | undefined,
  taxExempt = false,
): number {
  if (taxExempt || !customerState) {
    return 0;
  }
  const state = customerState.trim().toUpperCase();
  if (!config?.nexusStates || config.nexusStates.length === 0) {
    return 0;
  }
  if (!config.nexusStates.map((s) => s.toUpperCase()).includes(state)) {
    return 0;
  }
  const stateInfo = US_STATES[state];
  if (!stateInfo) {
    return 0;
  }
  const override = config.rates?.[state];
  return override ?? stateInfo.rate;
}

export const FISCAL_REGIMES: Record<string, string> = {
  '601': 'General de Ley Personas Morales',
  '603': 'Personas Morales con Fines no Lucrativos',
  '606': 'Arrendamiento',
  '608': 'Demás ingresos',
  '610': 'Residentes en el Extranjero sin Establecimiento Permanente en México',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '616': 'Sin obligaciones fiscales',
  '621': 'Incorporación Fiscal',
  '625': 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626': 'Régimen Simplificado de Confianza',
};

export const USO_CFDI: Record<string, string> = {
  G01: 'Adquisición de mercancías',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  I02: 'Mobiliario y equipo de oficina por inversiones',
  I03: 'Equipo de transporte',
  I04: 'Equipo de cómputo y accesorios',
  I05: 'Dados, troqueles, moldes, matrices y herramental',
  I06: 'Comunicaciones telefónicas',
  I07: 'Comunicaciones satelitales',
  I08: 'Otra maquinaria y equipo',
  P01: 'Por definir',
  S01: 'Sin efectos fiscales',
  CP01: 'Pagos',
  CN01: 'Nómina',
};

export const CFDI_PAYMENT_FORMS: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica de fondos',
  '04': 'Tarjeta de crédito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '12': 'Dación en pago',
  '13': 'Pago por subrogación',
  '15': 'Beneficiarios directos de obras de infraestructura',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Condonación',
  '25': 'Condonación de cargos financieros',
  '99': 'Por definir',
};

export const CFDI_PAYMENT_METHODS: Record<string, string> = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido',
};

export const SAT_PRODUCT_KEYS: Record<string, string> = {
  '01010101': 'No existe en el catálogo',
  '10111500': 'Conservas alimenticias',
  '14111501': 'Bebidas no alcohólicas',
  '20101500': 'Productos de aseo y limpieza',
  '24111500': 'Prendas de vestir',
  '25111500': 'Material de oficina',
  '50111500': 'Equipos de cómputo y accesorios',
  '56101500': 'Servicios de transporte de mercancías',
  '84111500': 'Servicios profesionales, científicos y técnicos',
};

export const SAT_UNITS: Record<string, string> = {
  H87: 'Pieza',
  KGM: 'Kilogramo',
  GRM: 'Gramo',
  LTR: 'Litro',
  MTR: 'Metro',
  MTK: 'Metro cuadrado',
  TNE: 'Tonelada',
  LBR: 'Libra',
  GLL: 'Galón',
  EA: 'Elemento',
  E48: 'Unidad de servicio',
  HUR: 'Hora',
  DIA: 'Día',
  XUN: 'Unidad',
};

const UOM_TO_SAT_UNIT: Record<string, string> = {
  unit: 'H87',
  piece: 'H87',
  pza: 'H87',
  kilogram: 'KGM',
  kg: 'KGM',
  gram: 'GRM',
  g: 'GRM',
  liter: 'LTR',
  l: 'LTR',
  meter: 'MTR',
  m: 'MTR',
  hour: 'HUR',
  hr: 'HUR',
  day: 'DIA',
  service: 'E48',
};

export function satUnitForKey(uom: string | null | undefined): string {
  if (!uom) {
    return 'H87';
  }
  return UOM_TO_SAT_UNIT[uom.toLowerCase()] ?? 'H87';
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const today = (): string => new Date().toISOString().slice(0, 10);

export interface TotalsItem {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export function computeTotals(items: TotalsItem[], globalDiscount = 0) {
  const subtotal = round2(
    items.reduce((sum, i) => sum + (i.quantity * i.unitPrice - (i.discount ?? 0)), 0),
  );
  const tax = round2(
    items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.taxRate ?? 0), 0),
  );
  return {
    subtotal,
    discount: round2(globalDiscount),
    tax,
    total: round2(subtotal + tax - globalDiscount),
  };
}

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
}

export enum OutboxEventStatus {
  PENDING = 'pending',
  DISPATCHED = 'dispatched',
  FAILED = 'failed',
}

export interface OutboxEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  tenantId: string;
  occurredAt?: string;
  userId?: string | null;
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
