import { expect, Page, test } from '@playwright/test';

const gateway = process.env.PP8_GATEWAY_URL ?? 'http://localhost:8080';
const username = process.env.PP8_E2E_USERNAME;
const password = process.env.PP8_E2E_PASSWORD;
const enterpriseId = process.env.PP8_E2E_ENTERPRISE_ID ?? 'enterprise-e2e';
const paymentMethodId = Number(process.env.PP8_E2E_PAYMENT_METHOD_ID ?? '8');
const mailpit = process.env.PP8_MAILPIT_URL ?? 'http://localhost:18025';
const supplierTypeName = 'Proveedor';
let supplierId: number;

/** Fecha local ISO (YYYY-MM-DD) para evitar fechas fijas que caducan en @FutureOrPresent. */
function isoDateLocal(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha local desplazada N días respecto de hoy (reproducible en cada ejecución). */
function isoDateDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDateLocal(date);
}

test.describe.configure({ mode: 'serial' });

async function loginThroughAngular(page: Page): Promise<string> {
  if (!username || !password) {
    throw new Error('PP8_E2E_USERNAME y PP8_E2E_PASSWORD son obligatorios');
  }
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  page.on('requestfailed', request => {
    if (request.url().includes('/api/keycloak/')) {
      console.log(`Keycloak request failed: ${request.url()} - ${request.failure()?.errorText}`);
    }
  });
  const tokenResponse = page.waitForResponse(response => response.url().includes('/api/keycloak/token/'), {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  expect((await tokenResponse).status()).toBe(200);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
  await page.waitForURL(/#\/enterprise\/list/, { timeout: 20_000 });
  await page.evaluate((enterprise) => localStorage.setItem('entData', JSON.stringify({
    id: enterprise, name: 'PP8 E2E', nit: 'E2E', logo: '', inventoryConfigType: 'WEIGHTED_AVERAGE',
  })), enterpriseId);
  const token = (await page.evaluate(() => localStorage.getItem('token'))) as string;
  const suppliersResponse = await page.request.get(`${gateway}/api/thirds/by-type`, {
    headers: headers(token),
    params: { entId: enterpriseId, thirdTypeName: supplierTypeName },
  });
  expect(suppliersResponse.ok()).toBe(true);
  const suppliers = (await suppliersResponse.json()).content;
  expect(suppliers.length).toBeGreaterThan(0);
  supplierId = Number(suppliers[0].thId);
  return token;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function createPurchaseAndWaitForPayable(page: Page, token: string, amount = 100) {
  const factCode = Number(`${Date.now()}`.slice(-9));
  const response = await page.request.post(`${gateway}/api/factures/skeleton/purchase`, {
    headers: headers(token),
    data: {
      factCode, entId: enterpriseId, thId: supplierId,
      products: [{ productId: 1, amount: 1, description: 'Playwright PP8', discount: 0,
        unitPrice: amount, subtotal: amount, taxPercentage: [] }],
      totalValue: String(amount), totalPay: '0', pendingValue: String(amount),
      factureType: 'PURCHASE', inventoryConfigType: 'WEIGHTED_AVERAGE',
    },
  });
  expect(response.status()).toBe(201);
  let payable: any;
  await expect.poll(async () => {
    const pending = await page.request.get(`${gateway}/api/treasury/payables/pending`, {
      headers: headers(token), params: { enterpriseId },
    });
    if (!pending.ok()) return false;
    payable = (await pending.json()).find((item: any) => item.reference === String(factCode));
    return Boolean(payable);
  }).toBe(true);
  expect(payable.payableAccountId).toBeTruthy();
  expect(payable.payableAccountCode).toBeTruthy();
  return { payable, factCode };
}

async function createAndPostVoucher(page: Page, token: string, payable: any, amount: number) {
  const created = await page.request.post(`${gateway}/api/treasury/payment-vouchers`, {
    headers: headers(token),
    data: {
      enterpriseId, issueDate: isoDateLocal(), paymentMethodId, bankAccountId: null,
      observations: 'Playwright PP8',
      details: [{ supplierId, invoiceId: payable.id, amount }],
    },
  });
  expect(created.ok()).toBe(true);
  const voucher = await created.json();
  const posted = await page.request.post(`${gateway}/api/treasury/payment-vouchers/${voucher.id}/post`, {
    headers: { ...headers(token), 'Idempotency-Key': `pw-${voucher.id}-${Date.now()}` },
    params: { enterpriseId },
  });
  expect(posted.ok()).toBe(true);
  await expect.poll(async () => {
    const result = await page.request.get(`${gateway}/api/treasury/payment-vouchers/${voucher.id}`, {
      headers: headers(token), params: { enterpriseId },
    });
    return result.ok() ? (await result.json()).status : 'HTTP_ERROR';
  }).toBe('POSTED');
  return voucher.id as number;
}

test('1. login, rol y acceso a Tesorería por Angular y Gateway', async ({ page }) => {
  await loginThroughAngular(page);
  await page.goto('/#/financial/treasury/operations');
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  await expect(page.locator('.p-card-title', { hasText: 'Obligaciones pendientes' })).toBeVisible();
  await expect(page.locator('.p-card').first()).toBeVisible();
  await expect(page.locator('.p-datatable').first()).toBeVisible();
  await expect(page.locator('button.p-button').first()).toBeVisible();
});

test('2. compra → obligación → pago → asiento → correo con servicios reales', async ({ page }) => {
  const token = await loginThroughAngular(page);
  const beforeMail = (await (await page.request.get(`${mailpit}/api/v1/messages`)).json()).messages_count;
  const { payable } = await createPurchaseAndWaitForPayable(page, token);
  const suppliers = await page.request.get(`${gateway}/api/thirds/by-type`, {
    headers: headers(token),
    params: { entId: enterpriseId, thirdTypeName: supplierTypeName },
  });
  expect(suppliers.ok()).toBe(true);
  const supplier = (await suppliers.json()).content.find((item: any) => Number(item.thId) === supplierId);
  expect(supplier).toBeTruthy();
  const supplierLabel = supplier.socialReason
    || [supplier.names, supplier.lastNames].filter(Boolean).join(' ')
    || `Proveedor ${supplierId}`;
  await page.goto('/#/financial/treasury/operations');
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  await expect(page.locator('.p-datatable').first().getByText(supplierLabel, { exact: false }).first()).toBeVisible();
  const voucherId = await createAndPostVoucher(page, token, payable, 40);
  const voucher = await (await page.request.get(`${gateway}/api/treasury/payment-vouchers/${voucherId}`, {
    headers: headers(token), params: { enterpriseId },
  })).json();
  expect(voucher.accountingEntryId).toBeTruthy();
  await expect.poll(async () => (await (await page.request.get(`${mailpit}/api/v1/messages`)).json()).messages_count,
    { timeout: 35_000 })
    .toBe(beforeMail + 1);
});

test('3. anulación espera aceptación y termina VOIDED', async ({ page }) => {
  const token = await loginThroughAngular(page);
  const { payable } = await createPurchaseAndWaitForPayable(page, token);
  const voucherId = await createAndPostVoucher(page, token, payable, 25);
  const response = await page.request.post(`${gateway}/api/treasury/payment-vouchers/${voucherId}/void`, {
    headers: headers(token), params: { enterpriseId }, data: { reason: 'Playwright PP8 void' },
  });
  expect(response.ok()).toBe(true);
  await expect.poll(async () => {
    const result = await page.request.get(`${gateway}/api/treasury/payment-vouchers/${voucherId}`, {
      headers: headers(token), params: { enterpriseId },
    });
    return result.ok() ? (await result.json()).status : 'HTTP_ERROR';
  }).toBe('VOIDED');
});

test('4. programación termina EXECUTED solo con comprobante contabilizado', async ({ page }) => {
  const token = await loginThroughAngular(page);
  const { payable } = await createPurchaseAndWaitForPayable(page, token);
  const created = await page.request.post(`${gateway}/api/treasury/payment-schedules`, {
    headers: headers(token),
    data: {
      enterpriseId, executionDate: isoDateLocal(), paymentMethodId, bankAccountId: null,
      observations: 'Playwright PP8 schedule',
      details: [{ supplierId, invoiceId: payable.id, amount: 15 }],
    },
  });
  expect(created.ok()).toBe(true);
  const schedule = await created.json();
  let executed: any;
  await expect.poll(async () => {
    const result = await page.request.get(`${gateway}/api/treasury/payment-schedules/${schedule.id}`, {
      headers: headers(token),
    });
    if (!result.ok()) return 'HTTP_ERROR';
    executed = await result.json();
    return executed.status;
  }).toBe('EXECUTED');
  const voucher = await (await page.request.get(`${gateway}/api/treasury/payment-vouchers/${executed.voucherId}`, {
    headers: headers(token), params: { enterpriseId },
  })).json();
  expect(voucher.status).toBe('POSTED');
  expect(voucher.accountingEntryId).toBeTruthy();
});
