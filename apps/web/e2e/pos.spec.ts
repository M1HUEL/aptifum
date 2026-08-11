import { expect, test } from '@playwright/test';
import { addStock, createProduct, createWarehouse, seedAuth } from './helpers';

test('sells a product at the point of sale and collects payment', async ({ context, page }) => {
  const { accessToken } = await seedAuth(context);

  const suffix = Date.now();
  const warehouse = await createWarehouse(accessToken);
  const product = await createProduct(accessToken, {
    sku: `E2E-POS-${suffix}`,
    name: 'E2E Espresso',
    salePrice: 10,
  });
  await addStock(accessToken, { productId: product.id, warehouseId: warehouse.id, quantity: 5 });

  await page.goto('/pos');
  await page.locator('#pos-warehouse').selectOption({ label: warehouse.name });

  const productCard = page.locator('.pos-product', { hasText: 'E2E Espresso' });
  await expect(productCard).toBeVisible();
  await expect(productCard).toContainText('$10.00');
  await expect(productCard).toContainText('5 in stock');
  await productCard.click();

  const line = page.locator('.pos-line', { hasText: 'E2E Espresso' });
  await expect(line).toBeVisible();
  await line.getByLabel('Unit price for E2E Espresso').fill('10');
  await line.getByLabel('Tax for E2E Espresso').fill('10');
  await expect(page.getByText('$11.00', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Charge $11.00' }).click();

  await expect(page.getByText('Payment for', { exact: false })).toBeVisible();
  await page.locator('#payment-method').selectOption('transfer');
  await page.getByRole('button', { name: 'Record payment' }).click();

  await expect(page.locator('.pos-success .success-banner')).toBeVisible();
  const successCard = page.locator('.pos-success');
  await expect(successCard).toContainText('Total');
  await expect(successCard).toContainText('$11.00');
  await expect(successCard).toContainText('Balance due');
  await expect(successCard).not.toContainText('$0.01');

  const invoiceNumber = (await successCard.locator('.card-title').textContent()) ?? '';
  expect(invoiceNumber).toMatch(/^Invoice /);

  await page.getByRole('button', { name: 'New sale' }).click();
  await expect(page.getByText('Tap a product to add it to the ticket.')).toBeVisible();

  await page.goto('/invoices');
  const invoiceRow = page.locator('.data-table tbody tr', { hasText: invoiceNumber.replace('Invoice ', '') });
  await expect(invoiceRow).toBeVisible();
  await expect(invoiceRow).toContainText('Walk-in Customer');
});
