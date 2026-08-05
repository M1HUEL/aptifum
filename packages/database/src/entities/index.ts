import { AuditLog } from './audit-log.entity';
import { Category } from './category.entity';
import { Customer } from './customer.entity';
import { DocumentSeries } from './document-series.entity';
import { GoodsReceipt } from './goods-receipt.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { IdempotencyKey } from './idempotency-key.entity';
import { Invoice } from './invoice.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';
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
];

export {
  AuditLog,
  Category,
  Customer,
  DocumentSeries,
  GoodsReceipt,
  GoodsReceiptItem,
  IdempotencyKey,
  Invoice,
  InvoiceItem,
  Payment,
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
