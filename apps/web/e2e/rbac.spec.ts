import { expect, test } from '@playwright/test';
import { createUser, findRoleId, getApiTokens, login, seedAuth } from './helpers';

test('seller role cannot access user management', async ({ browser, context, page }) => {
  await seedAuth(context);
  const { accessToken } = await getApiTokens();
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
  await login(sellerPage, email, 'Seller123!');
  await expect(sellerPage.getByText('E2E Seller')).toBeVisible();

  await expect(sellerPage.getByRole('link', { name: 'Users & roles' })).toHaveCount(0);

  await sellerPage.goto('/users-roles');
  await expect(sellerPage.locator('.error-banner').first()).toBeVisible();

  await sellerContext.close();
});
