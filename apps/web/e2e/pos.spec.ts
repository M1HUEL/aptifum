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

  const productCard = page.getByRole('button', { name: /E2E Espresso/ });
  await expect(productCard).toBeVisible();
  await expect(productCard).toContainText('$10.00');
  await expect(productCard).toContainText('5 in stock');
  await productCard.click();

  const unitPrice = page.getByLabel('Unit price for E2E Espresso');
  await expect(unitPrice).toBeVisible();
  await unitPrice.fill('10');
  await page.getByLabel('Tax for E2E Espresso').fill('10');
  await expect(page.getByText('$11.00', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Charge $11.00' }).click();

  await expect(page.getByText('Payment for', { exact: false })).toBeVisible();
  await page.locator('#payment-method').selectOption('transfer');
  await page.getByRole('button', { name: 'Record payment' }).click();

  const successPanel = page.locator('div.mb-5.rounded-ui', { hasText: 'Sale completed' });
  await expect(successPanel).toBeVisible();
  await expect(successPanel).toContainText('Total');
  await expect(successPanel).toContainText('$11.00');
  await expect(successPanel).toContainText('Balance due');
  await expect(successPanel).not.toContainText('$0.01');

  const invoiceNumber = (await successPanel.getByRole('heading', { name: /^Invoice / }).textContent()) ?? '';
  expect(invoiceNumber).toMatch(/^Invoice /);

  await successPanel.getByRole('button', { name: 'New sale' }).click();
  await expect(page.getByText('Tap a product to add it to the ticket.', { exact: true })).toBeVisible();

  await page.goto('/invoices');
  const invoiceRow = page.locator('[data-testid="data-table"] tbody tr', {
    hasText: invoiceNumber.replace('Invoice ', ''),
  });
  await expect(invoiceRow).toBeVisible();
  await expect(invoiceRow).toContainText('Walk-in Customer');
});
