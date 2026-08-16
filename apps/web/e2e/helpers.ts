import { expect, type BrowserContext, type Page, request } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@aptifum.dev';
export const ADMIN_PASSWORD = 'Admin123!';

const BASE_URL = 'http://localhost:5173';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

let cachedTokens: AuthTokens | null = null;

export async function getApiTokens(): Promise<AuthTokens> {
  if (cachedTokens) return cachedTokens;
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!res.ok()) {
      throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
    }
    cachedTokens = (await res.json()) as AuthTokens;
    return cachedTokens;
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

export async function login(
  page: Page,
  email: string,
  password: string,
  expectedUrl: RegExp = /\/dashboard/,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(expectedUrl);
}

export async function selectSearchable(page: Page, id: string, label: string): Promise<void> {
  await page.locator(`#${id}`).click();
  await page.getByRole('option', { name: label, exact: true }).click();
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

export async function createCustomer(
  accessToken: string,
  input: { code: string; tradeName: string },
): Promise<{ id: string }> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/sales/customers', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: input,
    });
    if (!res.ok()) {
      throw new Error(`Create customer failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as { id: string };
  } finally {
    await ctx.dispose();
  }
}

export async function createSupplier(
  accessToken: string,
  input: { code: string; tradeName: string },
): Promise<{ id: string }> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/purchasing/suppliers', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: input,
    });
    if (!res.ok()) {
      throw new Error(`Create supplier failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as { id: string };
  } finally {
    await ctx.dispose();
  }
}

export async function createProduct(
  accessToken: string,
  input: { sku: string; name: string; salePrice?: number },
): Promise<{ id: string }> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/inventory/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { ...input, salePrice: input.salePrice ?? 5 },
    });
    if (!res.ok()) {
      throw new Error(`Create product failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as { id: string };
  } finally {
    await ctx.dispose();
  }
}

export async function addStock(
  accessToken: string,
  input: { productId: string; warehouseId: string; quantity: number },
): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/inventory/movements', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        movementType: 'inbound',
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        unitCost: 5,
        referenceType: 'e2e',
        notes: 'E2E inbound stock',
      },
    });
    if (!res.ok()) {
      throw new Error(`Add stock failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

interface SalesOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export async function createSalesOrder(
  accessToken: string,
  input: { customerId: string; warehouseId: string; items: SalesOrderItemInput[] },
): Promise<{ id: string }> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/sales/orders', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { kind: 'order', customerId: input.customerId, warehouseId: input.warehouseId, items: input.items },
    });
    if (!res.ok()) {
      throw new Error(`Create sales order failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as { id: string };
  } finally {
    await ctx.dispose();
  }
}

export async function confirmSalesOrder(accessToken: string, id: string): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post(`/api/v1/sales/orders/${id}/confirm`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok()) {
      throw new Error(`Confirm sales order failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

interface PurchaseOrderItemInput {
  productId: string;
  quantity: number;
  unitCost?: number;
}

export async function createPurchaseOrder(
  accessToken: string,
  input: { supplierId: string; warehouseId: string; items: PurchaseOrderItemInput[] },
): Promise<{ id: string }> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post('/api/v1/purchasing/purchase-orders', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { supplierId: input.supplierId, warehouseId: input.warehouseId, items: input.items },
    });
    if (!res.ok()) {
      throw new Error(`Create purchase order failed: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as { id: string };
  } finally {
    await ctx.dispose();
  }
}

export async function approvePurchaseOrder(accessToken: string, id: string): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  try {
    const res = await ctx.post(`/api/v1/purchasing/purchase-orders/${id}/approve`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok()) {
      throw new Error(`Approve purchase order failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await ctx.dispose();
  }
}
