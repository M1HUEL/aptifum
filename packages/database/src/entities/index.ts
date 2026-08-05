import { AccountingPeriod } from './accounting-period.entity';
import { AuditLog } from './audit-log.entity';
import { Category } from './category.entity';
import { ChartAccount } from './chart-account.entity';
import { CrmActivity } from './crm-activity.entity';
import { CrmContact } from './crm-contact.entity';
import { CrmLead } from './crm-lead.entity';
import { CrmOpportunity } from './crm-opportunity.entity';
import { Customer } from './customer.entity';
import { Department } from './hr-department.entity';
import { DocumentSeries } from './document-series.entity';
import { Employee } from './hr-employee.entity';
import { GoodsReceipt } from './goods-receipt.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { AttendanceRecord } from './hr-attendance.entity';
import { IdempotencyKey } from './idempotency-key.entity';
import { Invoice } from './invoice.entity';
import { InvoiceItem } from './invoice-item.entity';
import { JournalEntry } from './journal-entry.entity';
import { JournalEntryLine } from './journal-entry-line.entity';
import { Leave } from './hr-leave.entity';
import { Payment } from './payment.entity';
import { Payroll } from './hr-payroll.entity';
import { PayrollLine } from './hr-payroll-line.entity';
import { Product } from './product.entity';
import { ProductStock } from './product-stock.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Role } from './role.entity';
import { SalesOrder } from './sales-order.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { StockMovement } from './stock-movement.entity';
import { Supplier } from './supplier.entity';
import { Tax } from './tax.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { Warehouse } from './warehouse.entity';
import { WarehouseLocation } from './warehouse-location.entity';

export const entities = [
  User,
  Role,
  Tenant,
  AuditLog,
  Category,
  Product,
  Warehouse,
  WarehouseLocation,
  ProductStock,
  StockMovement,
  Customer,
  Tax,
  DocumentSeries,
  SalesOrder,
  SalesOrderItem,
  Invoice,
  InvoiceItem,
  Payment,
  IdempotencyKey,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  AccountingPeriod,
  ChartAccount,
  JournalEntry,
  JournalEntryLine,
  Department,
  Employee,
  AttendanceRecord,
  Leave,
  Payroll,
  PayrollLine,
];

export {
  AccountingPeriod,
  AuditLog,
  Category,
  ChartAccount,
  CrmActivity,
  CrmContact,
  CrmLead,
  CrmOpportunity,
  Customer,
  Department,
  DocumentSeries,
  Employee,
  GoodsReceipt,
  GoodsReceiptItem,
  AttendanceRecord,
  IdempotencyKey,
  Invoice,
  InvoiceItem,
  JournalEntry,
  JournalEntryLine,
  Leave,
  Payment,
  Payroll,
  PayrollLine,
  Product,
  ProductStock,
  PurchaseOrder,
  PurchaseOrderItem,
  Role,
  SalesOrder,
  SalesOrderItem,
  StockMovement,
  Supplier,
  Tax,
  Tenant,
  User,
  Warehouse,
  WarehouseLocation,
};