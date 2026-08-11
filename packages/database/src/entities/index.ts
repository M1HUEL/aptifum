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
import { OutboxEvent } from './outbox-event.entity';
import { Payment } from './payment.entity';
import { Payroll } from './hr-payroll.entity';
import { PayrollLine } from './hr-payroll-line.entity';
import { Product } from './product.entity';
import { ProductStock } from './product-stock.entity';
import { ProductionBom } from './production-bom.entity';
import { ProductionBomLine } from './production-bom-line.entity';
import { ProductionOrder } from './production-order.entity';
import { ProductionOrderLine } from './production-order-line.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { RefreshSession } from './refresh-session.entity';
import { Role } from './role.entity';
import { SalesOrder } from './sales-order.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { StockMovement } from './stock-movement.entity';
import { Supplier } from './supplier.entity';
import { SupplierPayment } from './supplier-payment.entity';
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
  RefreshSession,
  GoodsReceipt,
  GoodsReceiptItem,
  SupplierPayment,
  ProductionBom,
  ProductionBomLine,
  ProductionOrder,
  ProductionOrderLine,
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
  OutboxEvent,
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
  OutboxEvent,
  Payment,
  Payroll,
  PayrollLine,
  Product,
  ProductStock,
  ProductionBom,
  ProductionBomLine,
  ProductionOrder,
  ProductionOrderLine,
  PurchaseOrder,
  PurchaseOrderItem,
  RefreshSession,
  Role,
  SalesOrder,
  SalesOrderItem,
  StockMovement,
  Supplier,
  SupplierPayment,
  Tax,
  Tenant,
  User,
  Warehouse,
  WarehouseLocation,
};