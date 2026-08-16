import { expect, test } from '@playwright/test';
import { createUser, findRoleId, login, seedAuth } from './helpers';

test('seller role cannot access user management', async ({ browser, context, page }) => {
  const { accessToken } = await seedAuth(context);
  const sellerRoleId = await findRoleId(accessToken, 'seller');
  const email = `seller-${Date.now()}@aptifum.dev`;
  await createUser(accessToken, {
    email,
    password: 'Seller123!',
    name: 'E2E Seller',
    roleIds: [sellerRoleId],
  });

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await login(sellerPage, email, 'Seller123!', /\/403/);
  await expect(sellerPage.getByRole('heading', { name: '403' })).toBeVisible();

  await sellerPage.goto('/pos');
  await expect(sellerPage.getByRole('link', { name: 'Users & roles' })).toHaveCount(0);

  await sellerPage.goto('/users-roles');
  await expect(sellerPage).toHaveURL(/\/403$/);
  await expect(sellerPage.getByRole('heading', { name: '403' })).toBeVisible();

  await sellerContext.close();
});
