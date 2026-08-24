import { AccountingPeriod } from './accounting-period.entity';
import { AuditLog } from './audit-log.entity';
import { Category } from './category.entity';
import { CfdiCertificate } from './cfdi-certificate.entity';
import { CfdiDocument } from './cfdi-document.entity';
import { ChartAccount } from './chart-account.entity';
import { CrmActivity } from './crm-activity.entity';
import { CrmContact } from './crm-contact.entity';
import { CrmLead } from './crm-lead.entity';
import { CrmOpportunity } from './crm-opportunity.entity';
import { Customer } from './customer.entity';
import { DocumentSeries } from './document-series.entity';
import { ExchangeRate } from './exchange-rate.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { GoodsReceipt } from './goods-receipt.entity';
import { AttendanceRecord } from './hr-attendance.entity';
import { Department } from './hr-department.entity';
import { Employee } from './hr-employee.entity';
import { Leave } from './hr-leave.entity';
import { PayrollLine } from './hr-payroll-line.entity';
import { Payroll } from './hr-payroll.entity';
import { IdempotencyKey } from './idempotency-key.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Invoice } from './invoice.entity';
import { JournalEntryLine } from './journal-entry-line.entity';
import { JournalEntry } from './journal-entry.entity';
import { OutboxEvent } from './outbox-event.entity';
import { PaymentProviderConfig } from './payment-provider.entity';
import { Payment } from './payment.entity';
import { ProductLot } from './product-lot.entity';
import { ProductStock } from './product-stock.entity';
import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';
import { ProductionBomLine } from './production-bom-line.entity';
import { ProductionBom } from './production-bom.entity';
import { ProductionOrderLine } from './production-order-line.entity';
import { ProductionOrder } from './production-order.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { RefreshSession } from './refresh-session.entity';
import { Role } from './role.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { SalesOrder } from './sales-order.entity';
import { StockMovement } from './stock-movement.entity';
import { SupplierBillItem } from './supplier-bill-item.entity';
import { SupplierBill } from './supplier-bill.entity';
import { SupplierPayment } from './supplier-payment.entity';
import { Supplier } from './supplier.entity';
import { Tax } from './tax.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { WarehouseLocation } from './warehouse-location.entity';
import { Warehouse } from './warehouse.entity';

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
