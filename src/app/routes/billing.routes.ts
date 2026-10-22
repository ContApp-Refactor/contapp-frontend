import { Routes } from '@angular/router';
import { BillingCounterpartyCatalog } from '../Billing/services/billing-counterparty-catalog';
import { MockBillingCounterpartyCatalog } from '../Billing/services/mock-billing-counterparty-catalog';
import { BillingProductCatalog } from '../Billing/services/billing-product-catalog';
import { MockBillingProductCatalog } from '../Billing/services/mock-billing-product-catalog';
import { BillingSaleInvoiceApi } from '../Billing/services/billing-sale-invoice.api';
import { MockBillingSaleInvoiceApi } from '../Billing/services/mock-billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../Billing/services/billing-sale-return.api';
import { MockBillingSaleReturnApi } from '../Billing/services/mock-billing-sale-return.api';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    // Sin esto la ruta vacía hereda el breadcrumb 'Facturación' de app.routes.ts y se duplica
    data: { breadcrumb: null },
    // Para pasar a HTTP: cambiar `useClass` por la implementación real (única línea a tocar)
    providers: [
      { provide: BillingSaleInvoiceApi, useClass: MockBillingSaleInvoiceApi },
      { provide: BillingSaleReturnApi, useClass: MockBillingSaleReturnApi },
      // Catálogo con datos quemados. Para usar los productos reales: InventoryBillingProductCatalog
      { provide: BillingProductCatalog, useClass: MockBillingProductCatalog },
      // Clientes (venta) y proveedores (compra) con datos quemados
      { provide: BillingCounterpartyCatalog, useClass: MockBillingCounterpartyCatalog },
    ],
    children: [
      {
        path: '',
        data: { breadcrumb: null },
        loadComponent: () =>
          import('../Billing/components/billing-menu/billing-menu.component').then(
            (m) => m.BillingMenuComponent,
          ),
      },
      {
        path: 'pending',
        data: { breadcrumb: 'Continuar Factura Pendiente', title: 'Continuar factura pendiente' },
        loadComponent: () =>
          import('../Billing/components/sale-invoice-pending/sale-invoice-pending.component').then(
            (m) => m.SaleInvoicePendingComponent,
          ),
      },
      // Compra y venta usan los mismos componentes; `data.kind` define el tipo de documento
      {
        path: 'purchase/new',
        data: { breadcrumb: 'Nueva Factura Compra', title: 'Nueva Factura Compra', kind: 'PURCHASE' },
        loadComponent: () =>
          import('../Billing/components/sale-invoice-form/sale-invoice-form.component').then(
            (m) => m.SaleInvoiceFormComponent,
          ),
      },
      {
        path: 'purchase/:id',
        data: { breadcrumb: 'Factura Compra', title: 'Factura Compra', kind: 'PURCHASE' },
        loadComponent: () =>
          import('../Billing/components/sale-invoice-form/sale-invoice-form.component').then(
            (m) => m.SaleInvoiceFormComponent,
          ),
      },
      {
        path: 'purchase/:invoiceId/return/new',
        data: { breadcrumb: 'Nueva Devolución', title: 'Nueva devolución de compra', kind: 'PURCHASE' },
        loadComponent: () =>
          import('../Billing/components/sale-return-form/sale-return-form.component').then(
            (m) => m.SaleReturnFormComponent,
          ),
      },
      {
        path: 'sale/new',
        data: { breadcrumb: 'Nueva Factura Venta', title: 'Nueva Factura Venta', kind: 'SALE' },
        loadComponent: () =>
          import('../Billing/components/sale-invoice-form/sale-invoice-form.component').then(
            (m) => m.SaleInvoiceFormComponent,
          ),
      },
      {
        path: 'sale/:id',
        data: { breadcrumb: 'Factura Venta', title: 'Factura Venta', kind: 'SALE' },
        loadComponent: () =>
          import('../Billing/components/sale-invoice-form/sale-invoice-form.component').then(
            (m) => m.SaleInvoiceFormComponent,
          ),
      },
      {
        path: 'sale/:invoiceId/return/new',
        data: { breadcrumb: 'Nueva Devolución', title: 'Nueva devolución', kind: 'SALE' },
        loadComponent: () =>
          import('../Billing/components/sale-return-form/sale-return-form.component').then(
            (m) => m.SaleReturnFormComponent,
          ),
      },
      {
        path: 'return/:id',
        // Sirve a ambos tipos: el kind se toma de la devolución guardada
        data: { breadcrumb: 'Devolución', title: 'Devolución' },
        loadComponent: () =>
          import('../Billing/components/sale-return-form/sale-return-form.component').then(
            (m) => m.SaleReturnFormComponent,
          ),
      },
      {
        path: 'returns',
        data: { breadcrumb: 'Facturas con Devolución', title: 'Facturas con devolución' },
        loadComponent: () =>
          import('../Billing/components/sale-return-list/sale-return-list.component').then(
            (m) => m.SaleReturnListComponent,
          ),
      },
      {
        path: 'list',
        data: { breadcrumb: 'Ver Facturas', title: 'Ver facturas' },
        loadComponent: () =>
          import('../Billing/components/sale-invoice-list/sale-invoice-list.component').then(
            (m) => m.SaleInvoiceListComponent,
          ),
      },
    ],
  },
];
