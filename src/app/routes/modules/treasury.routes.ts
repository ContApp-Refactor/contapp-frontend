import { Routes } from '@angular/router';
import { hasAnyRoleGuard } from '../../Core/Guards/has-anyRole.guard';

const operationalRoles = ['Estudiante', 'Profesor', 'Administrador'];

export const TREASURY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'operations' },
  {
    path: 'operations',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Operaciones de Tesoreria' },
    loadComponent: () =>
      import('../../Financial/Treasury/Operations/treasury-operations.component').then(
        (m) => m.TreasuryOperationsComponent
      ),
  },
  {
    path: 'expense-receipts',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Comprobantes de Egreso' },
    loadComponent: () =>
      import('../../Financial/Treasury/ExpenseReceipts/Components/expense-receipts-list/expense-receipts-list.component').then(
        (m) => m.ExpenseReceiptsListComponent
      ),
  },
  {
    path: 'expense-receipts/creation',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Creación de Comprobantes' },
    loadComponent: () =>
      import('../../Financial/Treasury/ExpenseReceipts/Components/expense-receipt-creation/expense-receipt-creation.component').then(
        (m) => m.ExpenseReceiptCreationComponent
      ),
  },
  {
    path: 'expense-receipts/details/:id',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Detalles del Comprobante' },
    loadComponent: () =>
      import('../../Financial/Treasury/ExpenseReceipts/Components/expense-receipt-details/expense-receipt-details.component').then(
        (m) => m.ExpenseReceiptDetailsComponent
      ),
  },
  {
    path: 'expense-receipts/:id/accounting',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Contabilización del Comprobante' },
    loadComponent: () =>
      import('../../Financial/Treasury/ExpenseReceipts/Components/expense-receipt-accounting/expense-receipt-accounting.component').then(
        (m) => m.ExpenseReceiptAccountingComponent
      ),
  },
  {
    path: 'purchase-bills',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Programación Ordenes de Pago' },
    loadComponent: () =>
      import('../../Financial/Treasury/PurchaseBills/Components/bill-list/bill-list.component').then(
        (m) => m.BillListComponent
      ),
  },
  {
    path: 'purchase-bills/create',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Nueva Factura de Compra' },
    loadComponent: () =>
      import('../../Financial/Treasury/PurchaseBills/Components/bill-creation/bill-creation.component').then(
        (m) => m.BillCreationComponent
      ),
  },
  // Convenience aliases for workflows consolidated under Operaciones
  { path: 'payment-schedules', redirectTo: 'operations', pathMatch: 'full' },
  { path: 'payables', redirectTo: 'operations', pathMatch: 'full' },
  { path: 'payable-write-offs', redirectTo: 'operations', pathMatch: 'full' },
  {
    path: 'reports',
    canActivate: [hasAnyRoleGuard(operationalRoles)],
    data: { breadcrumb: 'Reportes' },
    children: [
      {
        path: 'vendors',
        data: { breadcrumb: 'Estado de cuenta por proveedor' },
        loadComponent: () =>
          import('../../Financial/Treasury/Reports/VendorReports/Components/vendor-list/vendor-list.component').then(
            (m) => m.VendorListComponent
          ),
      },
      {
        path: 'vendor-report/:id',
        data: { breadcrumb: 'Estado de cuenta' },
        loadComponent: () =>
          import('../../Financial/Treasury/Reports/VendorReports/Components/vendor-report/vendor-report.component').then(
            (m) => m.VendorReportComponent
          ),
      },
      {
        path: 'aging-report',
        data: { breadcrumb: 'Vencimiento por edades' },
        loadComponent: () =>
          import('../../Financial/Treasury/Reports/AgingReport/Components/aging-report/aging-report.component').then(
            (m) => m.AgingReportComponent
          ),
      },
    ],
  },
];
