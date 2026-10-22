import { Routes } from '@angular/router';

export const COMMERCIAL_ROUTES: Routes = [
  {
    path: '',
    data: { breadcrumb: null },
    loadComponent: () =>
      import('../Commercial/MenuCards/menu/menu.component').then(
        (m) => m.MenuComponent,
      ),
  },
  {
    path: 'business-masters',
    data: {
      breadcrumb: 'Maestros Comerciales',
    },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../Commercial/BusinessMasters/MenuCards/menu/menu.component').then(
            (m) => m.MenuComponent,
          ),
      },
      {
        path: 'kardex',
        data: {
          breadcrumb: 'Inventario - Promedio Ponderado',
        },
        loadComponent: () =>
          import('../Commercial/BusinessMasters/ValuationModels/WeightedAverage/list-kardex-weighted-average/list-kardex-weighted-average.component').then(
            (m) => m.ListKardexWeightedAverageComponent,
          ),
      },
      {
        path: 'peps',
        data: {
          breadcrumb: 'Inventario - PEPS',
        },
        loadComponent: () =>
          import('../Commercial/BusinessMasters/ValuationModels/PEPS/list-kardex-peps/list-kardex-peps.component').then(
            (m) => m.ListKardexPepsComponent,
          ),
      },
    ],
  },
  {
    path: 'sale-invoice',
    data: {
      breadcrumb: 'Factura de Venta',
    },
    loadComponent: () =>
      import('../Commercial/SaleInvoice/components/sale-invoice-creation/sale-invoice-creation.component').then(
        (m) => m.SaleInvoiceCreationComponent
      ),
  },
  {
    path: 'purchase-invoice',
    data: {
      breadcrumb: 'Factura de Compra',
    },
    loadComponent: () =>
      import('../Commercial/PurchaseInvoice/components/purchase-invoice-creation/purchase-invoice-creation.component').then(
        (m) => m.PurchaseInvoiceCreationComponent
      ),
  },
  {
    path: 'invoice-template',
    data: {
      breadcrumb: 'Plantilla de Factura',
    },
    loadComponent: () =>
      import('../Commercial/InvoiceTemplate/components/create-invoice/create-invoice.component').then(
        (m) => m.CreateInvoiceComponent
      ),
  },
  {
    path: 'return-template',
    data: {
      breadcrumb: 'Plantilla de Devolución',
    },
    loadComponent: () =>
      import('../Commercial/InvoiceTemplate/components/create-return/create-return.component').then(
        (m) => m.CreateReturnComponent
      ),
  },
  {
    path: 'non-commercial-template',
    data: {
      breadcrumb: 'Plantilla de Evento no Comercial',
    },
    loadComponent: () =>
      import('../Commercial/NonCommercialTemplate/components/create-non-commercial/create-non-commercial.component').then(
        (m) => m.CreateNonCommercialComponent
      ),
  },
];
