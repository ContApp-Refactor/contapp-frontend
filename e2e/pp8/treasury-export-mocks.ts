import { Page } from '@playwright/test';

export const EXPORT_ENTERPRISE_ID = 'enterprise-export-test';

const payables = [
  {
    id: 101,
    sourceInvoiceId: 50,
    reference: 'FC-9001',
    enterpriseId: EXPORT_ENTERPRISE_ID,
    supplierId: 77,
    originalAmount: 100000,
    paidAmount: 0,
    pendingAmount: 100000,
    reservedAmount: 0,
    availableAmount: 100000,
    issueDate: '2026-08-01',
    originalDueDate: '2026-08-30',
    dueDate: '2026-08-30',
    payableAccountId: 2205,
    payableAccountCode: '2205',
    active: true,
    version: 0,
  },
];

const vouchersPage = {
  content: [
    {
      id: 501,
      voucherNumber: 'CE-9001',
      enterpriseId: EXPORT_ENTERPRISE_ID,
      issueDate: '2026-08-10',
      status: 'POSTED',
      paymentMethodId: 8,
      total: 40000,
      observations: 'Pago Playwright',
      accountingEntryId: 999,
      version: 1,
      details: [
        {
          id: 1,
          supplierId: 77,
          invoiceId: 101,
          invoiceReference: 'FC-9001',
          payableAccountId: 2205,
          payableAccountCode: '2205',
          previousBalance: 100000,
          amountPaid: 40000,
          remainingBalance: 60000,
        },
      ],
    },
  ],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 20,
};

const statement = {
  supplierId: 77,
  invoiced: 100000,
  paid: 40000,
  pending: 60000,
  invoices: [
    {
      issueDate: '2026-08-01',
      dueDate: '2026-08-30',
      reference: 'FC-9001',
      originalAmount: 100000,
      pendingAmount: 60000,
    },
  ],
  vouchers: [
    {
      issueDate: '2026-08-10',
      voucherNumber: 'CE-9001',
      observations: 'Pago Playwright',
      details: [
        {
          supplierId: 77,
          invoiceReference: 'FC-9001',
          amountPaid: 40000,
          remainingBalance: 60000,
        },
      ],
    },
  ],
};

const agingLines = [
  {
    supplierId: 77,
    invoiceId: 101,
    reference: 'FC-9001',
    accountCode: '2205',
    dueDate: '2026-08-30',
    daysOverdue: 0,
    current: 60000,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days91Plus: 0,
  },
];

function fakeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200, sub: 'playwright-export' }),
  ).toString('base64url');
  return `${header}.${payload}.playwright-signature`;
}

export async function bootstrapTreasuryExportMocks(page: Page): Promise<void> {
  const token = fakeJwt();

  await page.addInitScript(() => {
    (window as any).__pp8ExportBlobs = [] as number[];
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        (window as any).__pp8ExportBlobs.push(obj.size);
      }
      return originalCreateObjectURL(obj);
    };

    const style = document.createElement('style');
    style.textContent = `
      .p-toast, p-toast, .p-toast-message, [role="alert"], .p-message, p-message {
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  });

  await page.addInitScript(
    ({ enterpriseId, jwt }) => {
      localStorage.setItem('token', jwt);
      localStorage.setItem(
        'entData',
        JSON.stringify({
          id: enterpriseId,
          name: 'PP8 Export Test',
          nit: '900000001',
          logo: '',
          inventoryConfigType: 'WEIGHTED_AVERAGE',
        }),
      );
    },
    { enterpriseId: EXPORT_ENTERPRISE_ID, jwt: token },
  );

  await page.route('**/api/keycloak/getCurrentUser', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'playwright-export-user',
        username: 'playwright.export',
        email: 'playwright.export@test.local',
        roles: ['Administrador', 'Estudiante', 'Profesor'],
      }),
    });
  });

  await page.route('**/api/payments/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/expiring')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, code: 'NO_CONTENT', data: [] }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.route('**/api/treasury/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/payables/pending')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payables) });
    }
    if (url.pathname.endsWith('/payment-vouchers')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vouchersPage) });
    }
    if (url.pathname.includes('/payment-vouchers/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vouchersPage.content[0]) });
    }
    if (url.pathname.endsWith('/payment-schedules')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 601,
            enterpriseId: EXPORT_ENTERPRISE_ID,
            executionDate: '2026-08-15',
            status: 'SCHEDULED',
            paymentMethodId: 8,
            total: 25000,
            retryCount: 0,
            voucherId: null,
            details: [],
          },
        ]),
      });
    }
    if (url.pathname.endsWith('/payable-write-offs')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 701, status: 'DRAFT', total: 10000, reason: 'Ajuste Playwright' },
        ]),
      });
    }
    if (url.pathname.endsWith('/reports/statement')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statement) });
    }
    if (url.pathname.endsWith('/reports/aging')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(agingLines) });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/thirds/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ thId: 77, socialReason: 'Proveedor Playwright SA', names: '', lastNames: '' }],
        totalElements: 1,
      }),
    });
  });

  await page.route('**/api/accountCatalogue/**', async (route) => {
    const url = route.request().url();
    if (url.includes('payment-methods')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: [{ id: 8, name: 'Transferencia', requiresBankAccount: false, status: true }],
        }),
      });
    }
    if (url.includes('bank-accounts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: [] }),
      });
    }
    if (url.includes('/auxiliary/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auxiliaryAccounts: [
            {
              id: 2205,
              code: '2205',
              description: 'CxP Proveedores',
              nature: 'Credito',
              financialStatus: 'Pasivo',
              classification: 'Auxiliar',
              parent: null,
              children: [],
              crossing: false,
              costCenter: false,
              status: true,
            },
          ],
        }),
      });
    }
    if (url.includes('bankAccounts') || url.includes('bank-accounts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: [] }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}
