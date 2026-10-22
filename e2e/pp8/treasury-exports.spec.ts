import { expect, Page, test } from '@playwright/test';
import { bootstrapTreasuryExportMocks } from './treasury-export-mocks';

test.describe.configure({ mode: 'serial' });

async function clickExportAndVerify(page: Page, buttonName: string, ext: string): Promise<void> {
  const button = page.getByRole('button', { name: buttonName });
  await expect(button).toBeEnabled({ timeout: 60_000 });

  if (/pdf/i.test(ext)) {
    await page.locator('[role="alert"] button, .p-toast-close-button, button[aria-label="Close"]').first().click({ force: true, timeout: 2_000 }).catch(() => undefined);
  }

  const beforeBlobCount = await page.evaluate(() => ((window as any).__pp8ExportBlobs || []).length);

  await page.evaluate((label) => {
    const button = Array.from(document.querySelectorAll('button')).find((item) =>
      item.textContent?.includes(label),
    ) as HTMLButtonElement | undefined;
    if (!button) {
      throw new Error(`Botón no encontrado: ${label}`);
    }
    button.click();
  }, buttonName);

  await expect
    .poll(async () => {
      const blobs = await page.evaluate(() => (window as any).__pp8ExportBlobs || []);
      if (blobs.length > beforeBlobCount) {
        return blobs[blobs.length - 1] > 100 ? 'blob' : null;
      }

      const toastText = await page
        .locator('.p-toast-detail, .p-toast-message-text, .p-toast-summary')
        .allTextContents();
      const hasSuccessToast = toastText.some(
        (text) => new RegExp(ext, 'i').test(text) && !/Error|No se pudo/i.test(text),
      );
      return hasSuccessToast ? 'toast' : null;
    }, { timeout: 30_000 })
    .not.toBeNull();

  await expect(page.locator('.p-toast-detail, .p-toast-message-text').filter({ hasText: /Error|No se pudo/i })).toHaveCount(0);
  await expect(
    page.locator('.p-toast-detail, .p-toast-message-text, .p-toast-summary').filter({ hasText: new RegExp(ext, 'i') }).first(),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('BROWSER LOG ERROR:', msg.text());
  });
  await bootstrapTreasuryExportMocks(page);
});

test('1. Operaciones de Tesorería exporta CSV y PDF', async ({ page }) => {
  await page.goto('/#/financial/treasury/operations');
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'FC-9001' }).first()).toBeVisible({ timeout: 15_000 });

  await clickExportAndVerify(page, 'Exportar CSV', 'csv');
  await page.waitForTimeout(1200);
  await clickExportAndVerify(page, 'Exportar PDF', 'pdf');
});

test('2. Programación de pagos exporta CSV y PDF', async ({ page }) => {
  await page.goto('/#/financial/treasury/purchase-bills');
  await expect(page.getByRole('heading', { name: /Programaci[oó]n Pagos de Factura/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'FC-9001' }).first()).toBeVisible({ timeout: 15_000 });

  await clickExportAndVerify(page, 'Exportar CSV', 'csv');
  await page.waitForTimeout(1200);
  await clickExportAndVerify(page, 'Exportar PDF', 'pdf');
});

test('3. Comprobantes de egreso exporta CSV y PDF', async ({ page }) => {
  await page.goto('/#/financial/treasury/expense-receipts');
  await expect(page.getByRole('heading', { name: /Comprobantes de Egreso/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'CE-9001' }).first()).toBeVisible({ timeout: 15_000 });

  await clickExportAndVerify(page, 'Exportar CSV', 'csv');
  await page.waitForTimeout(1200);
  await clickExportAndVerify(page, 'Exportar PDF', 'pdf');
});

test('4. Vencimiento por edades exporta CSV y PDF', async ({ page }) => {
  await page.goto('/#/financial/treasury/reports/aging-report');
  await expect(page.getByRole('heading', { name: /Vencimiento por edades/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'FC-9001' }).first()).toBeVisible({ timeout: 20_000 });

  await clickExportAndVerify(page, 'Exportar CSV', 'csv');
  await page.waitForTimeout(1200);
  await clickExportAndVerify(page, 'Exportar PDF', 'pdf');
});

test('5. Reportes de proveedores (lista) exporta CSV y PDF', async ({ page }) => {
  await page.goto('/#/financial/treasury/reports/vendors');
  await expect(page.getByRole('heading', { name: /Reportes de Proveedores/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'Proveedor Playwright SA' }).first()).toBeVisible({ timeout: 20_000 });

  await clickExportAndVerify(page, 'Exportar CSV', 'csv');
  await page.waitForTimeout(1200);
  await clickExportAndVerify(page, 'Exportar PDF', 'pdf');
});

test('6. Estado de cuenta por proveedor (detalle) exporta CSV y PDF', async ({ page }) => {
  await page.goto('/#/financial/treasury/reports/vendor-report/77?name=Proveedor%20Playwright%20SA');
  await expect(page.getByRole('heading', { name: /Estado de cuenta/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'FC-9001' }).first()).toBeVisible({ timeout: 20_000 });

  await clickExportAndVerify(page, 'Exportar CSV', 'csv');
  await page.waitForTimeout(1200);
  await clickExportAndVerify(page, 'Exportar PDF', 'pdf');
});
