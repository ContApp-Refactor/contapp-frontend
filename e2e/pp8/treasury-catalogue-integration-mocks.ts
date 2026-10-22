import { Page } from '@playwright/test';

export const CATALOGUE_ENTERPRISE_ID = 'enterprise-catalogue-test';

const auxiliaryAccounts = {
  auxiliaryAccounts: [
    {
      id: 1101,
      code: '11100501',
      description: 'Banco operativo',
      nature: 'Debito',
      financialStatus: 'Estado de Situacion Financiero',
      classification: 'Activo Corriente',
      parent: null,
      children: [],
      crossing: false,
      costCenter: false,
      status: true,
    },
    {
      id: 2205,
      code: '22050101',
      description: 'CxP Proveedores',
      nature: 'Credito',
      financialStatus: 'Estado de Situacion Financiero',
      classification: 'Pasivo Corriente',
      parent: null,
      children: [],
      crossing: false,
      costCenter: false,
      status: true,
    },
    {
      id: 5199,
      code: '51999901',
      description: 'Gasto inactivo',
      nature: 'Debito',
      financialStatus: 'Estado de Resultados',
      classification: 'Gastos Operacionales',
      parent: null,
      children: [],
      crossing: false,
      costCenter: false,
      status: false,
    },
  ],
  totalCount: 3,
  idEnterprise: CATALOGUE_ENTERPRISE_ID,
};

const paymentMethods = {
  content: [
    {
      id: 8,
      name: 'Transferencia activa',
      accountingAccount: '11100501 - Banco operativo',
      accountingAccountId: 1101,
      status: true,
      requiresBankAccount: true,
    },
    {
      id: 9,
      name: 'Metodo cuenta inactiva',
      accountingAccount: '51999901 - Gasto inactivo',
      accountingAccountId: 5199,
      status: true,
      requiresBankAccount: false,
    },
  ],
};

function fakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 7200,
      sub: 'playwright-catalogue',
      authorization: {
        permissions: [
          { rsname: 'PM', scopes: ['C', 'U', 'R', 'L'] },
          { rsname: 'AC', scopes: ['C', 'U', 'R', 'L', 'I', 'ET'] },
        ],
      },
    }),
  ).toString('base64url');
  return `${header}.${payload}.playwright-signature`;
}

export async function bootstrapCatalogueTreasuryMocks(page: Page): Promise<void> {
  const token = fakeJwt();

  await page.addInitScript(
    ({ enterpriseId, jwt }) => {
      localStorage.setItem('token', jwt);
      localStorage.setItem(
        'entData',
        JSON.stringify({
          id: enterpriseId,
          name: 'PP8 Catalogue Test',
          nit: '900000002',
          logo: '',
          inventoryConfigType: 'WEIGHTED_AVERAGE',
        }),
      );
    },
    { enterpriseId: CATALOGUE_ENTERPRISE_ID, jwt: token },
  );

  await page.route('**/api/keycloak/getCurrentUser', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'playwright-catalogue-user',
        username: 'playwright.catalogue',
        email: 'playwright.catalogue@test.local',
        roles: ['Administrador'],
      }),
    });
  });

  await page.route('**/api/payments/**', async (route) => {
    if (route.request().url().includes('/expiring')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, code: 'NO_CONTENT', data: [] }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.route('**/api/accountCatalogue/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auxiliary/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auxiliaryAccounts) });
    }
    if (url.includes('payment-methods/findAllActive')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paymentMethods) });
    }
    if (url.includes('bank-accounts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: [{ id: 501, accountNumber: '123456789', bank: { name: 'Banco Test' }, status: true }],
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/treasury/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/payables/pending')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            sourceInvoiceId: 50,
            reference: 'FC-CAT-1',
            enterpriseId: CATALOGUE_ENTERPRISE_ID,
            supplierId: 77,
            originalAmount: 50000,
            paidAmount: 0,
            pendingAmount: 50000,
            reservedAmount: 0,
            availableAmount: 50000,
            issueDate: '2026-08-01',
            originalDueDate: '2026-08-30',
            dueDate: '2026-08-30',
            payableAccountId: 2205,
            payableAccountCode: '22050101',
            active: true,
            version: 0,
          },
        ]),
      });
    }
    if (url.pathname.endsWith('/payment-vouchers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
      });
    }
    if (url.pathname.endsWith('/payment-schedules')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.pathname.endsWith('/payable-write-offs')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}
