import { Routes } from '@angular/router';
import { hasPermissionGuard } from '../../Core/Guards/has-permission.guard';

export const WALLET_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'menu',
    pathMatch: 'full',
  },

  {
    path: 'menu',
    data: {
      breadcrumb: null,
    },
    loadComponent: () =>
      import('../../Financial/Wallet/components/MenuCars/menu/menu.component').then(
        (m) => m.MenuComponent,
      ),
  },

  {
    path: 'receipts',
    data: {
      breadcrumb: 'Recibos de Caja',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/CashReceipts/Components/receipts-list/receipts-list.component').then(
        (m) => m.ReceiptsListComponent,
      ),
  },
  {
    path: 'receipts/creation',
    data: {
      breadcrumb: 'Creación de Recibos',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/CashReceipts/Components/receipt-creation/receipt-creation.component').then(
        (m) => m.ReceiptCreationComponent,
      ),
    canActivate: [hasPermissionGuard(['PR#C'])],
  },
  {
    path: 'receipts/details/:id',
    data: {
      breadcrumb: 'Detalles del Recibo',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/CashReceipts/Components/receipt-details/receipt-details.component').then(
        (m) => m.ReceiptDetailsComponent,
      ),
  },
  {
    path: 'receipts/:id/accounting',
    data: {
      breadcrumb: 'Contabilización del Recibo',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/CashReceipts/Components/receipt-accounting/receipt-accounting.component').then(
        (m) => m.ReceiptAccountingComponent,
      ),
  },
  {
    path: 'write-offs',
    data: {
      breadcrumb: 'Castigos de cartera',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/PortfolioWriteOffs/Components/write-off-list/write-off-list.component').then(
        (m) => m.WriteOffListComponent,
      ),
  },
  {
    path: 'write-offs/creation',
    data: {
      breadcrumb: 'Creación de castigo',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/PortfolioWriteOffs/Components/write-off-creation/write-off-creation.component').then(
        (m) => m.WriteOffCreationComponent,
      ),
    canActivate: [hasPermissionGuard(['PWO#C'])],
  },
  {
    path: 'write-offs/details/:id',
    data: {
      breadcrumb: 'Detalles del castigo',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/PortfolioWriteOffs/Components/write-off-details/write-off-details.component').then(
        (m) => m.WriteOffDetailsComponent,
      ),
  },
  {
    path: 'accounting-entries',
    data: {
      breadcrumb: 'Asientos Contables',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/Accounting/Components/accounting-entries/accounting-entries.component').then(
        (m) => m.AccountingEntriesComponent,
      ),
  },
  {
    path: 'invoices',
    data: {
      breadcrumb: 'Facturas',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/PortfolioManagement/Components/invoice-list/invoice-list.component').then(
        (m) => m.InvoiceListComponent,
      ),
  },
  {
    path: 'invoices/expiring',
    data: {
      breadcrumb: 'Facturas por Vencer',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/PortfolioManagement/Components/expiring-invoices/expiring-invoices.component').then(
        (m) => m.ExpiringInvoicesComponent,
      ),
  },
  {
    path: 'invoices/details/:id',
    data: {
      breadcrumb: 'Detalles de la Factura',
    },
    loadComponent: () =>
      import('../../Financial/Wallet/PortfolioManagement/Components/invoice-detail/invoice-detail.component').then(
        (m) => m.InvoiceDetailComponent,
      ),
  },
  {
    path: 'reports',
    data: {
      breadcrumb: 'Reportes',
    },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../../Financial/Wallet/Reports/Components/MenuCards/menu/menu.component').then(
            (m) => m.MenuComponent,
          ),
      },
      {
        path: 'client-portfolio',
        data: {
          breadcrumb: 'Cartera por Cliente',
        },
        loadComponent: () =>
          import('../../Financial/Wallet/Reports/Components/client-portfolio-list/client-portfolio-list.component').then(
            (m) => m.ClientPortfolioListComponent,
          ),
      },
      {
        path: 'aging-portfolio',
        data: {
          breadcrumb: 'Reporte de Vencimientos',
        },
        loadComponent: () =>
          import('../../Financial/Wallet/Reports/Components/aging-porfolio-report/aging-porfolio-report.component').then(
            (m) => m.AgingPorfolioReportComponent,
          ),
      },
      {
        path: 'client-invoices/:id',
        data: {
          breadcrumb: 'Facturas del Cliente',
        },
        loadComponent: () =>
          import('../../Financial/Wallet/Reports/Components/client-invoice-list/client-invoice-list.component').then(
            (m) => m.ClientInvoiceListComponent,
          ),
      },
      {
        path: 'client-invoice-receipts/:id',
        data: {
          breadcrumb: 'Comprobantes de Factura del Cliente',
        },
        loadComponent: () =>
          import('../../Financial/Wallet/Reports/Components/invoice-receipts-modal/invoice-receipts-modal.component').then(
            (m) => m.InvoiceReceiptsModalComponent,
          ),
      },
    ],
  },
];
