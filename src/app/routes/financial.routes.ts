import { Routes } from '@angular/router';

export const FINANCIAL_ROUTES: Routes = [
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
      import('../../app/Financial/MenuCards/menu/menu.component').then(
        (m) => m.MenuComponent,
      ),
  },
  {
    path: 'reports',
    data: {
      breadcrumb: 'Reportes',
    },
    loadChildren: () =>
      import('../routes/modules/financial-reports.routes').then((m) => m.FINANCIAL_REPORTS_ROUTES),
  },
  {
    path: 'wallet',
    data: {
      breadcrumb: 'Cartera',
    },
    loadChildren: () =>
      import('../routes/modules/wallet.routes').then((m) => m.WALLET_ROUTES),
  },
  {
    path: 'treasury',
    data: {
      breadcrumb: 'Tesorería',
    },
    loadChildren: () =>
      import('../routes/modules/treasury.routes').then((m) => m.TREASURY_ROUTES),
  },
];
