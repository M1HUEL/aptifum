import { AuditLog } from './audit-log.entity';
import { Category } from './category.entity';
import { Product } from './product.entity';
import { ProductStock } from './product-stock.entity';
import { Role } from './role.entity';
import { StockMovement } from './stock-movement.entity';
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
];

export {
  AuditLog,
  Category,
  Product,
  ProductStock,
  Role,
  StockMovement,
  Tenant,
  User,
  Warehouse,
  WarehouseLocation,
};
