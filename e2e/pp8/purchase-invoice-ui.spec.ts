import { expect, test } from '@playwright/test';

const gateway = process.env.PP8_GATEWAY_URL ?? 'http://localhost:8080';
const username = process.env.PP8_E2E_USERNAME;
const password = process.env.PP8_E2E_PASSWORD;
const enterpriseId = process.env.PP8_E2E_ENTERPRISE_ID ?? 'enterprise-e2e';
const supplierTypeName = 'Proveedor';

test('factura de compra selecciona un tercero activo y envía su thId', async ({ page }) => {
  if (!username || !password) {
    test.skip(true, 'PP8_E2E_USERNAME y PP8_E2E_PASSWORD son obligatorios');
  }

  await page.goto('/login');
  await page.locator('#username').fill(username!);
  await page.locator('#password').fill(password!);
  const tokenResponse = page.waitForResponse((response) =>
    response.url().includes('/api/keycloak/token/') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  expect((await tokenResponse).status()).toBe(200);
  await page.waitForURL(/#\/enterprise\/list/, { timeout: 20_000 });
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  await page.evaluate((enterprise) => localStorage.setItem('entData', JSON.stringify({
    id: enterprise, name: 'PP8 E2E', nit: 'E2E', logo: '', inventoryConfigType: 'WEIGHTED_AVERAGE',
  })), enterpriseId);

  const suppliersResponse = await page.request.get(`${gateway}/api/thirds/by-type`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { entId: enterpriseId, thirdTypeName: supplierTypeName },
  });
  expect(suppliersResponse.ok()).toBe(true);
  const suppliers = (await suppliersResponse.json()).content;
  expect(suppliers.length).toBeGreaterThan(0);
  const expectedThird = suppliers[0];

  const supplierLoad = page.waitForResponse((response) =>
    response.url().includes('/api/thirds/by-type') && response.request().method() === 'GET',
  );
  await page.goto('/#/commercial/purchase-invoice');
  expect((await supplierLoad).status()).toBe(200);
  await expect(page.getByRole('heading', { name: /Creaci[oó]n de Factura de Compra/i })).toBeVisible();
  const supplierInput = page.locator('#supplierSearch input');
  await expect(supplierInput).toBeVisible();
  await supplierInput.fill(String(expectedThird.idNumber));
  const supplierOptions = page.locator('[role="option"]').filter({ hasNotText: 'No se encontraron resultados' });
  await expect(supplierOptions.first()).toBeVisible();
  await expect(supplierOptions).not.toHaveCount(0);
  await supplierOptions.first().click();

  await page.route('**/api/products/findActivate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{
          id: 501, code: 'E2E-501', name: 'Producto E2E', description: 'Producto para validar payload',
          quantity: 10, unitOfMeasureId: null, categoryId: null, enterpriseId, cost: 100,
          state: true, reference: 'E2E-501', taxPercentage: 0,
        }],
        page: { size: 1, number: 0, totalElements: 1, totalPages: 1 },
      }),
    });
  });
  await page.getByRole('button', { name: 'Agregar productos' }).click();
  const productDialog = page.locator('.p-dialog');
  await expect(productDialog).toBeVisible();
  await expect(productDialog.getByText('E2E-501')).toBeVisible({ timeout: 10_000 });
  const productRow = productDialog.locator('tbody tr').filter({ hasText: 'E2E-501' });
  await productRow.getByRole('checkbox').click();
  const confirmSelection = productDialog.getByRole('button', { name: 'Confirmar Selección' });
  await expect(confirmSelection).toBeEnabled();
  await confirmSelection.click();
  await expect(productDialog).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText('Producto E2E')).toBeVisible();

  let purchasePayload: any;
  await page.route('**/api/factures/skeleton/purchase', async (route) => {
    purchasePayload = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 1 }) });
  });
  const saveButton = page.getByRole('button', { name: 'Guardar factura' });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();
  await expect.poll(() => purchasePayload?.thId).toBe(expectedThird.thId);

  await expect(page.getByText(/Plazo de pago/i)).toBeVisible();
  await expect(page.getByLabel(/ID Tercero/i)).toHaveCount(0);
  await expect(page.getByLabel(/Cuenta Contable/i)).toHaveCount(0);
});
