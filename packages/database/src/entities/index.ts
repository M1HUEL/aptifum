import { AccountingPeriod } from './accounting-period.entity.js';
import { AuditLog } from './audit-log.entity.js';
import { Category } from './category.entity.js';
import { CfdiCertificate } from './cfdi-certificate.entity.js';
import { CfdiDocument } from './cfdi-document.entity.js';
import { ChartAccount } from './chart-account.entity.js';
import { CrmActivity } from './crm-activity.entity.js';
import { CrmContact } from './crm-contact.entity.js';
import { CrmLead } from './crm-lead.entity.js';
import { CrmOpportunity } from './crm-opportunity.entity.js';
import { Customer } from './customer.entity.js';
import { DocumentSeries } from './document-series.entity.js';
import { ExchangeRate } from './exchange-rate.entity.js';
import { GoodsReceiptItem } from './goods-receipt-item.entity.js';
import { GoodsReceipt } from './goods-receipt.entity.js';
import { AttendanceRecord } from './hr-attendance.entity.js';
import { Department } from './hr-department.entity.js';
import { Employee } from './hr-employee.entity.js';
import { Leave } from './hr-leave.entity.js';
import { PayrollLine } from './hr-payroll-line.entity.js';
import { Payroll } from './hr-payroll.entity.js';
import { IdempotencyKey } from './idempotency-key.entity.js';
import { InvoiceItem } from './invoice-item.entity.js';
import { Invoice } from './invoice.entity.js';
import { JournalEntryLine } from './journal-entry-line.entity.js';
import { JournalEntry } from './journal-entry.entity.js';
import { OutboxEvent } from './outbox-event.entity.js';
import { PaymentProviderConfig } from './payment-provider.entity.js';
import { Payment } from './payment.entity.js';
import { ProductLot } from './product-lot.entity.js';
import { ProductStock } from './product-stock.entity.js';
import { ProductVariant } from './product-variant.entity.js';
import { Product } from './product.entity.js';
import { ProductionBomLine } from './production-bom-line.entity.js';
import { ProductionBom } from './production-bom.entity.js';
import { ProductionOrderLine } from './production-order-line.entity.js';
import { ProductionOrder } from './production-order.entity.js';
import { PurchaseOrderItem } from './purchase-order-item.entity.js';
import { PurchaseOrder } from './purchase-order.entity.js';
import { RefreshSession } from './refresh-session.entity.js';
import { Role } from './role.entity.js';
import { SalesOrderItem } from './sales-order-item.entity.js';
import { SalesOrder } from './sales-order.entity.js';
import { StockMovement } from './stock-movement.entity.js';
import { SupplierBillItem } from './supplier-bill-item.entity.js';
import { SupplierBill } from './supplier-bill.entity.js';
import { SupplierPayment } from './supplier-payment.entity.js';
import { Supplier } from './supplier.entity.js';
import { Tax } from './tax.entity.js';
import { Tenant } from './tenant.entity.js';
import { User } from './user.entity.js';
import { WarehouseLocation } from './warehouse-location.entity.js';
import { Warehouse } from './warehouse.entity.js';

export const entities = [
  User,
  Role,
  Tenant,
  AuditLog,
  Category,
  Product,
  ProductVariant,
  Warehouse,
  WarehouseLocation,
  ProductStock,
  StockMovement,
  ProductLot,
  Customer,
  Tax,
  DocumentSeries,
  ExchangeRate,
  SalesOrder,
  SalesOrderItem,
  Invoice,
  InvoiceItem,
  Payment,
  IdempotencyKey,
  Supplier,
  SupplierBill,
  SupplierBillItem,
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
  PaymentProviderConfig,
  CfdiDocument,
  CfdiCertificate,
];

export {
  AccountingPeriod,
  AuditLog,
  Category,
  CfdiCertificate,
  CfdiDocument,
  ChartAccount,
  CrmActivity,
  CrmContact,
  CrmLead,
  CrmOpportunity,
  Customer,
  Department,
  DocumentSeries,
  Employee,
  ExchangeRate,
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
  PaymentProviderConfig,
  Payroll,
  PayrollLine,
  Product,
  ProductLot,
  ProductStock,
  ProductVariant,
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
  SupplierBill,
  SupplierBillItem,
  SupplierPayment,
  Tax,
  Tenant,
  User,
  Warehouse,
  WarehouseLocation,
};
