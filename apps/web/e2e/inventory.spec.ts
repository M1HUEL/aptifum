import { expect, test } from '@playwright/test';
import { createWarehouse, seedAuth, selectSearchable } from './helpers';

test('creates a product and records a stock movement', async ({ context, page }) => {
  const { accessToken } = await seedAuth(context);
  const warehouse = await createWarehouse(accessToken);

  const sku = `E2E-${Date.now()}`;

  await page.goto('/products');
  await page.getByRole('button', { name: 'New product' }).first().click();
  await page.locator('#product-sku').fill(sku);
  await page.locator('#product-name').fill('E2E Widget');
  await page.locator('#product-uom').fill('unit');
  await page.locator('#product-purchase').fill('5');
  await page.locator('#product-sale').fill('12');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created.', { exact: true })).toBeVisible();
  await expect(page.getByText(sku).first()).toBeVisible();

  await page.getByRole('link', { name: 'Stock' }).click();
  await page.getByRole('button', { name: 'New movement' }).click();
  await page.locator('#movement-product').selectOption({ label: `${sku} · E2E Widget` });
  await selectSearchable(page, 'movement-warehouse', warehouse.name);
  await page.locator('#movement-quantity').fill('10');
  await page.locator('#movement-cost').fill('5');
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.getByText('Stock movement recorded.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Movements' }).click();
  await expect(page.getByText(`${sku} · E2E Widget`)).toBeVisible();
});
