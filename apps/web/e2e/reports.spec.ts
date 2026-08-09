import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers';

test('lists reports and exports a CSV', async ({ context, page }) => {
  await seedAuth(context);
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

  const reportSelect = page.locator('.toolbar select');
  await expect(reportSelect.locator('option')).toHaveCount(12);
  await expect(reportSelect.locator('option[value="payroll"]')).toHaveText('Payroll summary');

  await reportSelect.selectOption({ label: 'Inventory valuation' });
  await expect(page.locator('.report-print-heading h2')).toHaveText('Inventory valuation');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.csv');
});
