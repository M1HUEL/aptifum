import { expect, type BrowserContext, type Page, request } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@aptifum.dev';
export const ADMIN_PASSWORD = 'Admin123!';

const BASE_URL = 'http://localhost:5173';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getApiTokens(): Promise<AuthTokens> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!res.ok()) {
      throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as AuthTokens;
  } finally {
    await ctx.dispose();
  }
}

export async function seedAuth(context: BrowserContext): Promise<AuthTokens> {
  const tokens = await getApiTokens();
  await context.addInitScript(
    ({ access, refresh }) => {
      window.localStorage.setItem('aptifum.accessToken', access);
      window.localStorage.setItem('aptifum.refreshToken', refresh);
    },
    { access: tokens.accessToken, refresh: tokens.refreshToken },
  );
  return tokens;
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

interface Warehouse {
  id: string;
  name: string;
}

export async function createWarehouse(accessToken: string): Promise<Warehouse> {
  const suffix = Date.now();
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/inventory/warehouses', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { code: `E2E_WH_${suffix}`, name: `E2E Warehouse ${suffix}` },
    });
    if (!res.ok()) {
      throw new Error(`Create warehouse failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as Warehouse;
  } finally {
    await ctx.dispose();
  }
}

export async function findRoleId(accessToken: string, name: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.get('/api/v1/roles', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok()) {
      throw new Error(`List roles failed: ${res.status()} ${await res.text()}`);
    }
    const roles = (await res.json()) as Array<{ id: string; name: string }>;
    const role = roles.find((item) => item.name === name);
    if (!role) throw new Error(`Role ${name} not found`);
    return role.id;
  } finally {
    await ctx.dispose();
  }
}

export async function createUser(
  accessToken: string,
  input: { email: string; password: string; name: string; roleIds: string[] },
): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: input,
    });
    if (!res.ok()) {
      throw new Error(`Create user failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}
