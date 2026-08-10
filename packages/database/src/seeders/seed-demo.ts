import { EmployeeStatus, MovementType } from '@aptifum/core';
import { createDataSource, DataSourceOverrides } from '../data-source';
import { Category } from '../entities/category.entity';
import { Customer } from '../entities/customer.entity';
import { Employee } from '../entities/hr-employee.entity';
import { Department } from '../entities/hr-department.entity';
import { Product } from '../entities/product.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { Supplier } from '../entities/supplier.entity';
import { Tenant } from '../entities/tenant.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { applyStockMovement } from '../services/stock';
import { DEFAULT_TENANT_ID } from './seed-data';

const WAREHOUSES = [
  { code: 'WH-01', name: 'Main Warehouse', address: '1200 Harbor Ave' },
  { code: 'WH-02', name: 'North Warehouse', address: '88 Park Road' },
];

const CATEGORIES = ['Food & Beverage', 'Cleaning Supplies', 'Office Supplies', 'Hardware'];

const PRODUCTS: Array<{
  sku: string;
  name: string;
  category: string;
  brand: string;
  unitOfMeasure: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
}> = [
  { sku: 'FBT-001', name: 'Espresso Beans 1kg', category: 'Food & Beverage', brand: 'Alpine Roast', unitOfMeasure: 'unit', purchasePrice: 12, salePrice: 24.5, stock: 120 },
  { sku: 'FBT-002', name: 'Green Tea 100 bags', category: 'Food & Beverage', brand: 'Mountain Leaf', unitOfMeasure: 'unit', purchasePrice: 4.5, salePrice: 9.9, stock: 80 },
  { sku: 'FBT-003', name: 'Bottled Water 24-pack', category: 'Food & Beverage', brand: 'ClearSpring', unitOfMeasure: 'case', purchasePrice: 6.2, salePrice: 12, stock: 200 },
  { sku: 'FBT-004', name: 'Granola Bars 12-pack', category: 'Food & Beverage', brand: 'Oat & Co', unitOfMeasure: 'unit', purchasePrice: 8, salePrice: 15.75, stock: 60 },
  { sku: 'CLN-001', name: 'All-Purpose Cleaner 1L', category: 'Cleaning Supplies', brand: 'Sparkle', unitOfMeasure: 'unit', purchasePrice: 3.1, salePrice: 6.8, stock: 150 },
  { sku: 'CLN-002', name: 'Dish Soap 750ml', category: 'Cleaning Supplies', brand: 'Sparkle', unitOfMeasure: 'unit', purchasePrice: 2.2, salePrice: 4.95, stock: 240 },
  { sku: 'CLN-003', name: 'Paper Towels 6 rolls', category: 'Cleaning Supplies', brand: 'SoftNest', unitOfMeasure: 'pack', purchasePrice: 7, salePrice: 13.5, stock: 90 },
  { sku: 'OFF-001', name: 'A4 Copy Paper 500 sheets', category: 'Office Supplies', brand: 'WhiteEdge', unitOfMeasure: 'ream', purchasePrice: 4.8, salePrice: 9.5, stock: 300 },
  { sku: 'OFF-002', name: 'Gel Pens (blue) box of 12', category: 'Office Supplies', brand: 'WriteOn', unitOfMeasure: 'box', purchasePrice: 5.5, salePrice: 11.25, stock: 70 },
  { sku: 'OFF-003', name: 'Sticky Notes 12-pack', category: 'Office Supplies', brand: 'WriteOn', unitOfMeasure: 'pack', purchasePrice: 3.6, salePrice: 7.2, stock: 110 },
  { sku: 'HDW-001', name: 'LED Desk Lamp', category: 'Hardware', brand: 'Lumen', unitOfMeasure: 'unit', purchasePrice: 14, salePrice: 29.9, stock: 40 },
  { sku: 'HDW-002', name: 'Extension Cord 5m', category: 'Hardware', brand: 'VoltMax', unitOfMeasure: 'unit', purchasePrice: 9.5, salePrice: 19.8, stock: 55 },
  { sku: 'HDW-003', name: 'Tool Kit 45 pieces', category: 'Hardware', brand: 'Grip', unitOfMeasure: 'unit', purchasePrice: 32, salePrice: 59, stock: 25 },
];

const CUSTOMERS: Array<{ code: string; tradeName: string; taxId: string; email: string; phone: string; creditLimit: number }> = [
  { code: 'C-001', tradeName: 'Cafe Central', taxId: '88-120-4455', email: 'orders@cafecentral.example', phone: '+1 555-0141', creditLimit: 5000 },
  { code: 'C-002', tradeName: 'GreenMart Stores', taxId: '92-300-7710', email: 'purchasing@greenmart.example', phone: '+1 555-0139', creditLimit: 15000 },
  { code: 'C-003', tradeName: 'OfficeHub LLC', taxId: '77-980-2233', email: 'buy@officehub.example', phone: '+1 555-0122', creditLimit: 10000 },
  { code: 'C-004', tradeName: 'Bright School', taxId: '84-556-9010', email: 'admin@brightschool.example', phone: '+1 555-0155', creditLimit: 3000 },
  { code: 'C-005', tradeName: 'Corner Grocery', taxId: '55-221-8840', email: 'mario@cornergrocery.example', phone: '+1 555-0118', creditLimit: 2000 },
];

const SUPPLIERS: Array<{ code: string; tradeName: string; taxId: string; email: string; phone: string; paymentTerms: string }> = [
  { code: 'S-001', tradeName: 'Alpine Roast Imports', taxId: '10-550-1200', email: 'sales@alpineroast.example', phone: '+1 555-0110', paymentTerms: 'net30' },
  { code: 'S-002', tradeName: 'Sparkle Home Care', taxId: '20-330-7715', email: 'b2b@sparkle.example', phone: '+1 555-0125', paymentTerms: 'net15' },
  { code: 'S-003', tradeName: 'WhiteEdge Paper Co', taxId: '30-990-2210', email: 'sales@whiteedge.example', phone: '+1 555-0130', paymentTerms: 'net30' },
  { code: 'S-004', tradeName: 'VoltMax Electrical', taxId: '40-115-5520', email: 'quotes@voltmax.example', phone: '+1 555-0140', paymentTerms: 'net45' },
];

const DEPARTMENTS: Array<{ code: string; name: string }> = [
  { code: 'D-SALES', name: 'Sales' },
  { code: 'D-PROD', name: 'Production' },
  { code: 'D-ADMIN', name: 'Administration' },
];

const EMPLOYEES: Array<{ employeeNo: string; firstName: string; lastName: string; email: string; position: string; department: string; hireDate: string; salary: number }> = [
  { employeeNo: 'E-001', firstName: 'Ana', lastName: 'Ruiz', email: 'ana.ruiz@aptifum.dev', position: 'Store Manager', department: 'D-ADMIN', hireDate: '2023-02-15', salary: 3800 },
  { employeeNo: 'E-002', firstName: 'Carlos', lastName: 'Mendez', email: 'carlos.mendez@aptifum.dev', position: 'Sales Associate', department: 'D-SALES', hireDate: '2023-06-01', salary: 2400 },
  { employeeNo: 'E-003', firstName: 'Lucia', lastName: 'Fernandez', email: 'lucia.fernandez@aptifum.dev', position: 'Sales Associate', department: 'D-SALES', hireDate: '2024-01-10', salary: 2400 },
  { employeeNo: 'E-004', firstName: 'Diego', lastName: 'Perez', email: 'diego.perez@aptifum.dev', position: 'Warehouse Lead', department: 'D-PROD', hireDate: '2022-09-20', salary: 2800 },
  { employeeNo: 'E-005', firstName: 'Marta', lastName: 'Gomez', email: 'marta.gomez@aptifum.dev', position: 'Accountant', department: 'D-ADMIN', hireDate: '2023-11-05', salary: 3200 },
];

export async function seedDemo(overrides: DataSourceOverrides = {}): Promise<void> {
  const ds = createDataSource(overrides);
  await ds.initialize();
  try {
    const tenant = await ds.getRepository(Tenant).findOneBy({ id: DEFAULT_TENANT_ID });
    if (!tenant) {
      throw new Error('Tenant not found. Run `pnpm seed` first.');
    }

    const warehouseRepo = ds.getRepository(Warehouse);
    const warehouses: Warehouse[] = [];
    for (const data of WAREHOUSES) {
      let warehouse = await warehouseRepo.findOneBy({ tenantId: tenant.id, code: data.code });
      if (!warehouse) {
        warehouse = await warehouseRepo.save(
          warehouseRepo.create({ tenantId: tenant.id, ...data }),
        );
      }
      warehouses.push(warehouse);
    }

    const categoryRepo = ds.getRepository(Category);
    const categories: Record<string, Category> = {};
    for (const name of CATEGORIES) {
      let category = await categoryRepo.findOneBy({ tenantId: tenant.id, name });
      if (!category) {
        category = await categoryRepo.save(categoryRepo.create({ tenantId: tenant.id, name }));
      }
      categories[name] = category;
    }

    const productRepo = ds.getRepository(Product);
    const productIds: Record<string, string> = {};
    for (const data of PRODUCTS) {
      let product = await productRepo.findOneBy({ tenantId: tenant.id, sku: data.sku });
      if (!product) {
        product = await productRepo.save(
          productRepo.create({
            tenantId: tenant.id,
            sku: data.sku,
            name: data.name,
            categoryId: categories[data.category].id,
            brand: data.brand,
            unitOfMeasure: data.unitOfMeasure,
            purchasePrice: data.purchasePrice,
            salePrice: data.salePrice,
            enabled: true,
          }),
        );
      }
      productIds[data.sku] = product.id;
    }

    const movementCount = await ds
      .getRepository(StockMovement)
      .createQueryBuilder('sm')
      .where('sm.tenant_id = :tenantId', { tenantId: tenant.id })
      .andWhere("sm.reference_type = 'seed'")
      .getCount();
    if (movementCount === 0) {
      await ds.transaction(async (manager) => {
        for (const data of PRODUCTS) {
          const warehouse = warehouses[0];
          await applyStockMovement(manager, {
            tenantId: tenant.id,
            movementType: MovementType.INBOUND,
            productId: productIds[data.sku],
            warehouseId: warehouse.id,
            quantity: data.stock,
            unitCost: data.purchasePrice,
            referenceType: 'seed',
          });
        }
      });
    }

    const customerRepo = ds.getRepository(Customer);
    for (const data of CUSTOMERS) {
      const existing = await customerRepo.findOneBy({ tenantId: tenant.id, code: data.code });
      if (!existing) {
        await customerRepo.save(customerRepo.create({ tenantId: tenant.id, ...data }));
      }
    }

    const supplierRepo = ds.getRepository(Supplier);
    for (const data of SUPPLIERS) {
      const existing = await supplierRepo.findOneBy({ tenantId: tenant.id, code: data.code });
      if (!existing) {
        await supplierRepo.save(supplierRepo.create({ tenantId: tenant.id, ...data }));
      }
    }

    const departmentRepo = ds.getRepository(Department);
    const departmentIds: Record<string, string> = {};
    for (const data of DEPARTMENTS) {
      let department = await departmentRepo.findOneBy({ tenantId: tenant.id, code: data.code });
      if (!department) {
        department = await departmentRepo.save(
          departmentRepo.create({ tenantId: tenant.id, ...data }),
        );
      }
      departmentIds[data.code] = department.id;
    }

    const employeeRepo = ds.getRepository(Employee);
    for (const data of EMPLOYEES) {
      const existing = await employeeRepo.findOneBy({
        tenantId: tenant.id,
        employeeNo: data.employeeNo,
      });
      if (!existing) {
        await employeeRepo.save(
          employeeRepo.create({
            tenantId: tenant.id,
            employeeNo: data.employeeNo,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            position: data.position,
            departmentId: departmentIds[data.department],
            hireDate: data.hireDate,
            salary: data.salary,
            salaryFrequency: 'monthly',
            status: EmployeeStatus.ACTIVE,
          }),
        );
      }
    }

    console.log(`Seeded demo data for tenant: ${tenant.name}`);
    console.log(`  Warehouses: ${warehouses.length}`);
    console.log(`  Categories: ${CATEGORIES.length}`);
    console.log(`  Products: ${PRODUCTS.length} (${movementCount === 0 ? 'stock seeded' : 'stock kept'})`);
    console.log(`  Customers: ${CUSTOMERS.length}`);
    console.log(`  Suppliers: ${SUPPLIERS.length}`);
    console.log(`  Departments: ${DEPARTMENTS.length}`);
    console.log(`  Employees: ${EMPLOYEES.length}`);
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) {
  seedDemo().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
