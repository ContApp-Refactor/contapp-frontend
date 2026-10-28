import { Routes } from '@angular/router';

export const ACCOUNTING_NOTES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  {
    path: 'list',
    data: { breadcrumb: 'Notas Contables' },
    loadComponent: () => import('../../Financial/AccountingNotes/Components/manual-entry-list/manual-entry-list.component').then((m) => m.ManualEntryListComponent),
  },
  {
    path: 'create',
    data: { breadcrumb: 'Registrar Nota Contable' },
    loadComponent: () => import('../../Financial/AccountingNotes/Components/manual-entry-form/manual-entry-form.component').then((m) => m.ManualEntryFormComponent),
  },
  {
    path: 'bulk',
    data: { breadcrumb: 'Registro Contable Masivo' },
    loadComponent: () => import('../../Financial/AccountingNotes/Components/bulk-entry/bulk-entry.component').then((m) => m.BulkEntryComponent),
  },
  {
    path: 'edit/:id',
    data: { breadcrumb: 'Editar Nota Contable' },
    loadComponent: () => import('../../Financial/AccountingNotes/Components/manual-entry-form/manual-entry-form.component').then((m) => m.ManualEntryFormComponent),
  },
  {
    path: 'movements',
    data: { breadcrumb: 'Movimientos Contables' },
    loadComponent: () => import('../../Financial/AccountingNotes/Components/transactions/transactions.component').then((m) => m.TransactionsComponent),
  },
];
