import { expect, Page, test } from '@playwright/test';

const gateway = process.env.PP8_GATEWAY_URL ?? 'http://localhost:8080';
const username = process.env.PP8_E2E_USERNAME;
const password = process.env.PP8_E2E_PASSWORD;
const enterpriseId = process.env.PP8_E2E_ENTERPRISE_ID ?? 'enterprise-e2e';
const supplierTypeName = 'Proveedor';

let supplierId: number;
let token: string;
let payable: any;
let factCode: number;
let counterpartAccount: { id: number; code: string; description: string } | undefined;
const totalAmount = 1000;
const partialAmount = 400;

function isoDateLocal(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function headers(authToken: string) {
  return { Authorization: `Bearer ${authToken}` };
}

async function loginThroughAngular(page: Page): Promise<string> {
  if (!username || !password) {
    throw new Error('PP8_E2E_USERNAME y PP8_E2E_PASSWORD son obligatorios');
  }
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  const tokenResponse = page.waitForResponse((response) =>
    response.url().includes('/api/keycloak/token/') && response.status() === 200,
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await tokenResponse;
  await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).not.toBeNull();
  await page.waitForURL(/#\/enterprise\/list/, { timeout: 20_000 });
  await page.evaluate((enterprise) => localStorage.setItem('entData', JSON.stringify({
    id: enterprise, name: 'PP8 E2E', nit: 'E2E', logo: '', inventoryConfigType: 'WEIGHTED_AVERAGE',
  })), enterpriseId);
  const authToken = (await page.evaluate(() => localStorage.getItem('token'))) as string;
  const suppliersResponse = await page.request.get(`${gateway}/api/thirds/by-type`, {
    headers: headers(authToken),
    params: { entId: enterpriseId, thirdTypeName: supplierTypeName },
  });
  expect(suppliersResponse.ok()).toBeTruthy();
  const suppliers = (await suppliersResponse.json()).content;
  expect(suppliers.length).toBeGreaterThan(0);
  supplierId = Number(suppliers[0].thId);
  return authToken;
}

async function createPurchaseAndWaitForPayable(page: Page, authToken: string) {
  factCode = Number(`${Date.now()}`.slice(-9));
  const response = await page.request.post(`${gateway}/api/factures/skeleton/purchase`, {
    headers: headers(authToken),
    data: {
      factCode,
      entId: enterpriseId,
      thId: supplierId,
      products: [{
        productId: 1,
        amount: 1,
        description: 'E2E Baja CxP',
        discount: 0,
        unitPrice: totalAmount,
        subtotal: totalAmount,
        taxPercentage: [],
      }],
      totalValue: String(totalAmount),
      totalPay: '0',
      pendingValue: String(totalAmount),
      factureType: 'PURCHASE',
      inventoryConfigType: 'WEIGHTED_AVERAGE',
    },
  });
  expect(response.status()).toBe(201);
  await expect.poll(async () => {
    const pending = await page.request.get(`${gateway}/api/treasury/payables/pending`, {
      headers: headers(authToken),
      params: { enterpriseId },
    });
    if (!pending.ok()) return false;
    payable = (await pending.json()).find((item: any) => item.reference === String(factCode));
    return Boolean(payable);
  }, { timeout: 45_000 }).toBeTruthy();
  expect(payable.payableAccountId).toBeTruthy();
  expect(payable.payableAccountCode).toBeTruthy();
}

async function pickCounterpartInDialog(page: Page, payableCode: string) {
  const dialog = page.getByRole('dialog', { name: 'Baja de CxP' });
  const dropdownHost = dialog.locator('p-dropdown').filter({
    has: dialog.locator('[id="writeOffCounterpartAccount"]'),
  });
  await dropdownHost.locator('.p-dropdown-trigger, button[aria-haspopup="listbox"]').first().click();
  const panel = page.locator('.p-dropdown-panel:visible, .p-select-overlay:visible').first();
  await expect(panel).toBeVisible({ timeout: 30_000 });
  const options = page.locator('.p-dropdown-item, .p-select-option, [role="option"]');
  await expect.poll(async () => await options.count(), { timeout: 30_000 }).toBeGreaterThan(0);
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = (await options.nth(index).textContent())?.trim() ?? '';
    if (!text || text.includes(payableCode)) {
      continue;
    }
    const match = text.match(/^(.+?)\s*-\s*(.+)$/);
    await options.nth(index).click();
    counterpartAccount = {
      id: -1,
      code: match?.[1]?.trim() ?? text,
      description: match?.[2]?.trim() ?? text,
    };
    return;
  }
  throw new Error('No se encontró cuenta contrapartida activa en el dropdown de la UI');
}

async function getPayableById(page: Page, authToken: string, invoiceId: number) {
  const pending = await page.request.get(`${gateway}/api/treasury/payables/pending`, {
    headers: headers(authToken),
    params: { enterpriseId },
  });
  expect(pending.ok()).toBeTruthy();
  return (await pending.json()).find((item: any) => item.id === invoiceId);
}

async function getWriteOff(page: Page, authToken: string, writeOffId: number) {
  const response = await page.request.get(`${gateway}/api/treasury/payable-write-offs/${writeOffId}`, {
    headers: headers(authToken),
  });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

async function getAccountingEntry(page: Page, authToken: string, entryId: number) {
  const response = await page.request.get(
    `${gateway}/api/accountCatalogue/accounting/entries/${entryId}`,
    { headers: headers(authToken) },
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}

async function openWriteOffDialogForReference(page: Page, reference: string) {
  await page.goto('/#/financial/treasury/operations');
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  const payablesCard = page.locator('.p-card').filter({ hasText: 'Obligaciones pendientes' });
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await page.waitForResponse((response) =>
    response.url().includes('/api/treasury/payables/pending') && response.ok(),
  );
  let row = payablesCard.locator('tbody tr').filter({ hasText: reference }).first();
  for (let attempt = 0; attempt < 15 && (await row.count()) === 0; attempt += 1) {
    const nextPage = payablesCard.locator('.p-paginator-next');
    if (await nextPage.isEnabled()) {
      await nextPage.click();
      await page.waitForTimeout(300);
      row = payablesCard.locator('tbody tr').filter({ hasText: reference }).first();
    } else {
      break;
    }
  }
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: 'Baja CxP' }).click();
  await expect(page.getByRole('dialog', { name: 'Baja de CxP' })).toBeVisible();
}

async function fillWriteOffDialog(page: Page, amount: number, reason: string) {
  const dialog = page.getByRole('dialog', { name: 'Baja de CxP' });
  const amountInput = dialog.getByRole('spinbutton', { name: 'Monto de baja *' });
  await amountInput.click();
  await amountInput.fill(String(amount));
  await pickCounterpartInDialog(page, payable.payableAccountCode);
  await dialog.getByRole('textbox', { name: 'Motivo *' }).fill(reason);
  await dialog.getByRole('button', { name: 'Crear baja' }).click();
}

test.describe.configure({ mode: 'serial' });

test('Baja de CxP E2E real', async ({ page }) => {
  token = await loginThroughAngular(page);
  await createPurchaseAndWaitForPayable(page, token);

  const reference = String(factCode);
  await openWriteOffDialogForReference(page, reference);
  const dialog = page.getByRole('dialog', { name: 'Baja de CxP' });
  await expect(dialog.getByText(reference)).toBeVisible();
  await expect(dialog.getByText(payable.payableAccountCode, { exact: false })).toBeVisible();
  await fillWriteOffDialog(page, partialAmount, 'E2E baja parcial CxP');

  await expect.poll(async () => {
    const list = await page.request.get(`${gateway}/api/treasury/payable-write-offs`, {
      headers: headers(token),
      params: { enterpriseId },
    });
    if (!list.ok()) return null;
    return (await list.json()).find((item: any) => item.reason === 'E2E baja parcial CxP');
  }, { timeout: 20_000 }).toBeTruthy();

  const writeOffs = await (await page.request.get(`${gateway}/api/treasury/payable-write-offs`, {
    headers: headers(token),
    params: { enterpriseId },
  })).json();
  const partialWriteOff = writeOffs.find((item: any) => item.reason === 'E2E baja parcial CxP');
  expect(partialWriteOff.status).toBe('DRAFT');
  expect(Number(partialWriteOff.total)).toBe(partialAmount);
  counterpartAccount = {
    id: partialWriteOff.counterpartAccountId,
    code: partialWriteOff.counterpartAccountCode,
    description: counterpartAccount?.description ?? partialWriteOff.counterpartAccountCode,
  };

  await page.locator('.p-card').filter({ hasText: 'Bajas de CxP' })
    .locator('tbody tr').filter({ hasText: 'E2E baja parcial CxP' })
    .getByRole('button', { name: 'Contabilizar' }).click();
  await expect.poll(async () => {
    const current = await getWriteOff(page, token, partialWriteOff.id);
    return current.status;
  }, { timeout: 45_000 }).toBe('POSTED');

  const postedPartial = await getWriteOff(page, token, partialWriteOff.id);
  expect(postedPartial.accountingEntryId).toBeTruthy();

  const remaining = totalAmount - partialAmount;
  await expect.poll(async () => {
    const currentPayable = await getPayableById(page, token, payable.id);
    return currentPayable ? Number(currentPayable.availableAmount) : -1;
  }, { timeout: 20_000 }).toBe(remaining);

  const entry = await getAccountingEntry(page, token, postedPartial.accountingEntryId);
  expect(entry.type).toBe('PAYABLE_WRITEOFF');
  const movements = entry.movements;
  expect(movements.length).toBe(2);
  const debitTotal = movements.reduce((sum: number, movement: any) => sum + Number(movement.debit), 0);
  const creditTotal = movements.reduce((sum: number, movement: any) => sum + Number(movement.credit), 0);
  expect(debitTotal).toBe(partialAmount);
  expect(creditTotal).toBe(partialAmount);
  const payableMovement = movements.find((movement: any) => movement.account === payable.payableAccountId);
  const counterpartMovement = movements.find((movement: any) => movement.account === counterpartAccount.id);
  expect(payableMovement).toBeTruthy();
  expect(Number(payableMovement.debit)).toBe(partialAmount);
  expect(Number(payableMovement.credit)).toBe(0);
  expect(counterpartMovement).toBeTruthy();
  expect(Number(counterpartMovement.credit)).toBe(partialAmount);
  expect(Number(counterpartMovement.debit)).toBe(0);

  const draftForVoidResponse = await page.request.post(`${gateway}/api/treasury/payable-write-offs`, {
    headers: headers(token),
    data: {
      enterpriseId,
      reason: 'E2E void draft probe',
      counterpartAccountId: counterpartAccount!.id,
      counterpartAccountCode: counterpartAccount!.code,
      details: [{ supplierId, invoiceId: payable.id, amount: 50 }],
    },
  });
  expect(draftForVoidResponse.ok()).toBeTruthy();
  const draftForVoid = await draftForVoidResponse.json();
  expect(draftForVoid.status).toBe('DRAFT');
  const voidResponse = await page.request.post(
    `${gateway}/api/treasury/payable-write-offs/${draftForVoid.id}/void`,
    { headers: headers(token) },
  );
  expect(voidResponse.ok()).toBeFalsy();
  await page.goto('/#/financial/treasury/operations');
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  const draftRow = page.locator('.p-card').filter({ hasText: 'Bajas de CxP' })
    .locator('tbody tr').filter({ hasText: 'E2E void draft probe' }).first();
  await expect(draftRow).toBeVisible();
  await expect(draftRow.getByRole('button', { name: 'Anular' })).toHaveCount(0);

  await openWriteOffDialogForReference(page, reference);
  await fillWriteOffDialog(page, remaining, 'E2E baja total CxP');

  await expect.poll(async () => {
    const list = await (await page.request.get(`${gateway}/api/treasury/payable-write-offs`, {
      headers: headers(token),
      params: { enterpriseId },
    })).json();
    return list.find((item: any) => item.reason === 'E2E baja total CxP');
  }, { timeout: 20_000 }).toBeTruthy();

  const totalWriteOff = (await (await page.request.get(`${gateway}/api/treasury/payable-write-offs`, {
    headers: headers(token),
    params: { enterpriseId },
  })).json()).find((item: any) => item.reason === 'E2E baja total CxP');
  expect(totalWriteOff.status).toBe('DRAFT');

  await page.locator('.p-card').filter({ hasText: 'Bajas de CxP' })
    .locator('tbody tr').filter({ hasText: 'E2E baja total CxP' })
    .getByRole('button', { name: 'Contabilizar' }).click();

  await expect.poll(async () => {
    const current = await getWriteOff(page, token, totalWriteOff.id);
    return current.status;
  }, { timeout: 45_000 }).toBe('POSTED');

  await expect.poll(async () => {
    const currentPayable = await getPayableById(page, token, payable.id);
    if (!currentPayable) return 0;
    return Number(currentPayable.availableAmount);
  }, { timeout: 20_000 }).toBe(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  const finalRow = page.locator('.p-card').filter({ hasText: 'Obligaciones pendientes' })
    .locator('tbody tr').filter({ hasText: reference });
  if (await finalRow.count() > 0) {
    const writeOffButton = finalRow.first().getByRole('button', { name: 'Baja CxP' });
    await expect(writeOffButton).toBeDisabled();
  }
});
