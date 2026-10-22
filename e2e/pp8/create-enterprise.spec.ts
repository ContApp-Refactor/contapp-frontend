import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = process.env.PP8_ANGULAR_URL || 'http://localhost:4200';
const USER = process.env.PP8_ADMIN_USERNAME || 'pp8.admin';
const PASS = process.env.PP8_ADMIN_PASSWORD || '';


async function pickDropdown(
  page: import('@playwright/test').Page,
  formControl: string,
  option: string | RegExp
) {
  const host = page.locator(`[formcontrolname="${formControl}"]`).first();
  await host.click();
  const panel = page.locator('.p-dropdown-panel:visible, .p-select-overlay:visible').first();
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  await page
    .locator('.p-dropdown-item, .p-select-option, li[role="option"]')
    .filter({ hasText: option })
    .first()
    .click();
}

test('create enterprise form submits without logo block', async ({ page }) => {
  if (!PASS) {
    throw new Error('PP8_ADMIN_PASSWORD es obligatorio');
  }
  page.setDefaultTimeout(20_000);

  await page.goto(`${BASE}/#/login`);
  await page.getByPlaceholder('usuario@unicauca.edu.co').fill(USER);
  await page.getByPlaceholder('**********').fill(PASS);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/#\/(?!login)/, { timeout: 30000 });

  await page.goto(`${BASE}/#/enterprise/create`);
  await expect(
    page.getByRole('heading', { name: 'Creación de Empresa' })
  ).toBeVisible();

  await page.waitForResponse(
    (r) => r.url().includes('/api/subjects') && r.status() < 500,
    { timeout: 15000 }
  ).catch(() => null);

  await page.locator('input[formcontrolname="name"]').fill('Empresa Playwright SA');
  await pickDropdown(page, 'enterpriseType', 'Privada');

  await page.locator('[formcontrolname="taxLiabilities"]').click();
  await page
    .locator('.p-multiselect-item, .p-multiselect-option, li[role="option"]')
    .filter({ hasText: 'IVA' })
    .first()
    .click();
  await page.keyboard.press('Escape');

  await page
    .locator('input[formcontrolname="legalName"]')
    .fill('Empresa Playwright Sociedad Anonima');
  await page.locator('input[formcontrolname="nit"]').fill('900123456');
  await page.locator('input[formcontrolname="dv"]').fill('1');
  await pickDropdown(page, 'taxPayerType', 'Responsable de IVA');
  await page.locator('input[formcontrolname="mainActivity"]').fill('620101');
  await page.locator('input[formcontrolname="secondaryActivity"]').fill('620102');

  await pickDropdown(page, 'country', 'Colombia');
  await pickDropdown(page, 'department', 'Cauca');
  await pickDropdown(page, 'city', 'Popayán');
  await page
    .locator('input[formcontrolname="email"]')
    .fill('empresa.playwright@example.test');
  await page
    .locator('input[formcontrolname="address"]')
    .fill('Calle 123 #45-67 Popayan');
  await page.locator('input[formcontrolname="phone"]').fill('3123456789');

  await pickDropdown(page, 'semester', /^1$/);
  await pickDropdown(page, 'subject', /Contabilidad/);
  await pickDropdown(page, 'inventoryConfigurationType', /PEPS/);

  // Assert client form is valid via Angular (dev mode)
  const validity = await page.evaluate(() => {
    const host = document.querySelector('app-create-enterprise');
    const ng = (window as any).ng;
    if (!host || !ng?.getComponent) return { ok: false, reason: 'no-ng' };
    const cmp = ng.getComponent(host);
    return {
      ok: true,
      valid: cmp.enterpriseForm?.valid,
      invalid: Object.keys(cmp.enterpriseForm?.controls || {}).filter(
        (k: string) => cmp.enterpriseForm.get(k)?.invalid
      ),
      hasFile: !!cmp.selectedFile,
    };
  });

  const createRespPromise = page
    .waitForResponse(
      (r) =>
        r.url().includes('/api/enterprises') &&
        r.request().method() === 'POST',
      { timeout: 15000 }
    )
    .catch(() => null);

  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForTimeout(2000);

  const toastText = (
    await page.locator('.p-toast-detail, .p-toast-message').allTextContents()
  ).join(' | ');
  const createResp = await createRespPromise;
  const report = {
    validity,
    toastText,
    createStatus: createResp?.status() ?? null,
    createBody: createResp ? await createResp.text().catch(() => '') : null,
    url: page.url(),
  };
  fs.writeFileSync(
    path.join(process.env.TEMP || '/tmp', 'pp8-create-enterprise-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));

  expect(validity.valid, `Form invalid: ${JSON.stringify(validity)}`).toBeTruthy();
  expect(
    /Faltan campos por llenar/.test(toastText) && !createResp,
    `Still blocked by client validation: ${toastText}`
  ).toBeFalsy();
});
