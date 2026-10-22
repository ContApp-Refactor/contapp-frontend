import { expect, test } from '@playwright/test';
import { bootstrapCatalogueTreasuryMocks } from './treasury-catalogue-integration-mocks';

test.beforeEach(async ({ page }) => {
  await bootstrapCatalogueTreasuryMocks(page);
});

test('Tesorería oculta cuentas inactivas en baja de CxP y métodos con cuenta contable inactiva', async ({ page }) => {
  await page.goto('/#/financial/treasury/operations');
  await expect(page.getByRole('heading', { name: /Operaciones de Tesorer[ií]a/i })).toBeVisible();
  await expect(page.locator('td', { hasText: 'FC-CAT-1' }).first()).toBeVisible({ timeout: 15_000 });

  await page.locator('#counterpartAccount').click({ force: true });
  await expect(page.getByRole('option', { name: /51999901/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /22050101/ })).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.locator('#paymentMethod').click({ force: true });
  await expect(page.getByRole('option', { name: /Metodo cuenta inactiva/i })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /Transferencia activa/i })).toHaveCount(1);
  await page.keyboard.press('Escape');
});

test('Crear método de pago solo lista cuentas auxiliares activas', async ({ page }) => {
  await page.goto('/#/gen-masters/payment-methods/create');
  await expect(page.getByRole('heading', { name: /Crear/i })).toBeVisible({ timeout: 15_000 });

  await page.locator('.p-select').first().click({ force: true });
  await expect(page.getByRole('option', { name: /51999901/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /11100501/ })).toHaveCount(1);
  await expect(page.getByRole('option', { name: /22050101/ })).toHaveCount(1);
});

test('Método con requiere cuenta bancaria muestra selector bancario al pagar', async ({ page }) => {
  await page.goto('/#/financial/treasury/operations');
  await expect(page.locator('td', { hasText: 'FC-CAT-1' }).first()).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('#bankAccount')).toHaveCount(0);

  await page.locator('#paymentMethod').click({ force: true });
  await page.getByRole('option', { name: /Transferencia activa/i }).click();

  await expect(page.locator('#bankAccount')).toBeVisible();
});
