import { expect, test } from '@playwright/test';
import {
  addStock,
  confirmSalesOrder,
  createCustomer,
  createProduct,
  createPurchaseOrder,
  createSalesOrder,
  createSupplier,
  createWarehouse,
  seedAuth,
} from './helpers';

test('creates a customer and a sales order in the UI, then confirms it', async ({ context, page }) => {
  const { accessToken } = await seedAuth(context);

  const suffix = Date.now();
  const warehouse = await createWarehouse(accessToken);
  const product = await createProduct(accessToken, { sku: `E2E-SO-${suffix}`, name: 'E2E Gadget' });
  await addStock(accessToken, { productId: product.id, warehouseId: warehouse.id, quantity: 10 });

  const customerCode = `CUS-${suffix}`;
  const customerName = `E2E Customer ${suffix}`;

  await page.goto('/customers');
  await page.getByRole('button', { name: 'New customer' }).click();
  await page.locator('#customer-code').fill(customerCode);
  await page.locator('#customer-trade').fill(customerName);
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByText('Customer created.')).toBeVisible();
  await expect(page.locator('.data-table tbody tr', { hasText: customerName })).toBeVisible();

  await page.getByRole('link', { name: 'Sales orders' }).click();
  await page.getByRole('button', { name: 'New sales order' }).click();
  await page.locator('#so-kind').selectOption('order');
  await page.locator('#so-customer').selectOption({ label: customerName });
  await page.locator('#so-warehouse').selectOption({ label: warehouse.name });
  await page.locator('#so-item-product-0').selectOption({ label: `${product.sku} · E2E Gadget` });
  await page.locator('#so-item-qty-0').fill('2');
  await page.locator('#so-item-price-0').fill('15');
  await page.getByRole('button', { name: 'Create sales order' }).click();
  await expect(page.getByText('Sales order created.')).toBeVisible();

  const orderRow = page.locator('.data-table tbody tr', { hasText: customerName });
  await expect(orderRow).toBeVisible();
  await orderRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Sales order confirmed.')).toBeVisible();
  await expect(orderRow.getByText('confirmed')).toBeVisible();
});

test('issues an invoice for a confirmed order, records a payment, and searches by customer', async ({
  context,
  page,
}) => {
  const { accessToken } = await seedAuth(context);

  const suffix = Date.now();
  const warehouse = await createWarehouse(accessToken);
  const product = await createProduct(accessToken, { sku: `E2E-INV-${suffix}`, name: 'E2E Widget' });
  await addStock(accessToken, { productId: product.id, warehouseId: warehouse.id, quantity: 10 });

  const customerName = `E2E Buyer ${suffix}`;
  const customer = await createCustomer(accessToken, { code: `CUS-${suffix}`, tradeName: customerName });
  const order = await createSalesOrder(accessToken, {
    customerId: customer.id,
    warehouseId: warehouse.id,
    items: [{ productId: product.id, quantity: 1, unitPrice: 15 }],
  });
  await confirmSalesOrder(accessToken, order.id);

  await page.goto('/invoices');
  await page.getByRole('button', { name: 'New invoice' }).click();
  await page.locator('#invoice-customer').selectOption({ label: customerName });
  await page.locator('#invoice-warehouse').selectOption({ label: warehouse.name });
  await page.locator('#invoice-item-product-0').selectOption({ label: `${product.sku} · E2E Widget` });
  await page.locator('#invoice-item-qty-0').fill('1');
  await page.locator('#invoice-item-price-0').fill('15');
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page.getByText('Invoice issued.')).toBeVisible();

  const invoiceRow = page.locator('.data-table tbody tr', { hasText: customerName });
  await expect(invoiceRow).toBeVisible();
  await invoiceRow.getByRole('button', { name: 'Payment' }).click();
  await page.locator('#payment-method').selectOption('transfer');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Payment recorded.')).toBeVisible();
  await expect(invoiceRow.getByText('$0.00')).toBeVisible();

  await page.getByRole('link', { name: 'Sales orders' }).click();
  await page.locator('.search-form input').fill(customerName);
  await page.getByRole('button', { name: 'Search' }).click();
  const searchedRow = page.locator('.data-table tbody tr', { hasText: customerName });
  await expect(searchedRow).toBeVisible();
});

test('creates a supplier and purchase order in the UI, then approves and receives goods', async ({
  context,
  page,
}) => {
  const { accessToken } = await seedAuth(context);

  const suffix = Date.now();
  const warehouse = await createWarehouse(accessToken);
  const product = await createProduct(accessToken, { sku: `E2E-PO-${suffix}`, name: 'E2E Part' });

  const supplierCode = `SUP-${suffix}`;
  const supplierName = `E2E Supplier ${suffix}`;

  await page.goto('/suppliers');
  await page.getByRole('button', { name: 'New supplier' }).click();
  await page.locator('#supplier-code').fill(supplierCode);
  await page.locator('#supplier-trade').fill(supplierName);
  await page.getByRole('button', { name: 'Create supplier' }).click();
  await expect(page.getByText('Supplier created.')).toBeVisible();
  await expect(page.locator('.data-table tbody tr', { hasText: supplierName })).toBeVisible();

  await page.getByRole('link', { name: 'Purchasing' }).click();
  await page.getByRole('button', { name: 'New purchase order' }).click();
  await page.locator('#po-supplier').selectOption({ label: supplierName });
  await page.locator('#po-warehouse').selectOption({ label: warehouse.name });
  await page.locator('#po-item-product-0').selectOption({ label: `${product.sku} · E2E Part` });
  await page.locator('#po-item-qty-0').fill('5');
  await page.locator('#po-item-cost-0').fill('4');
  await page.getByRole('button', { name: 'Create purchase order' }).click();
  await expect(page.getByText('Purchase order created.')).toBeVisible();

  const poRow = page.locator('.data-table tbody tr', { hasText: supplierName });
  await expect(poRow).toBeVisible();
  await poRow.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Purchase order approved.')).toBeVisible();
  await expect(poRow.getByText('approved')).toBeVisible();

  await poRow.getByRole('button', { name: 'Receive' }).click();
  const receiveQty = page.locator('input[id^="receive-qty-"]');
  await expect(receiveQty).toBeVisible();
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByText('Goods receipt recorded.')).toBeVisible();
  await expect(poRow.getByText('received')).toBeVisible();
});
