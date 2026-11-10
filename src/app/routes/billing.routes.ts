import { Route, Routes } from '@angular/router';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../Billing/models/document-kind';
import { BillingCounterpartyCatalog } from '../Billing/services/billing-counterparty-catalog';
import { InventoryBillingCounterpartyCatalog } from '../Billing/services/inventory-billing-counterparty-catalog.service';
import { BillingProductCatalog } from '../Billing/services/billing-product-catalog';
import { InventoryBillingProductCatalog } from '../Billing/services/inventory-billing-product-catalog.service';
import { BillingPaymentCatalog } from '../Billing/services/billing-payment-catalog';
import { AccountingBillingPaymentCatalog } from '../Billing/services/accounting-billing-payment-catalog.service';
import { BillingTaxCatalog } from '../Billing/services/billing-tax-catalog';
import { GeneralMastersBillingTaxCatalog } from '../Billing/services/general-masters-billing-tax-catalog.service';
import { BillingSaleInvoiceApi } from '../Billing/services/billing-sale-invoice.api';
import { MockBillingSaleInvoiceApi } from '../Billing/services/mock-billing-sale-invoice.api';
import { BillingHttpSaleInvoiceApi } from '../Billing/services/billing-http-sale-invoice.api';
import { BillingSaleReturnApi } from '../Billing/services/billing-sale-return.api';
import { MockBillingSaleReturnApi } from '../Billing/services/mock-billing-sale-return.api';
import { BillingHttpSaleReturnApi } from '../Billing/services/billing-http-sale-return.api';

// Hijos de /billing/purchase y /billing/sale. Las estáticas van antes que ':id' para que no choquen.
export function kindRoutes(kind: DocumentKind): Route[] {
  const cfg = DOCUMENT_KIND_CONFIG[kind];
  return [
    {
      path: '',
      // Hub del tipo: hereda el breadcrumb del padre (no se duplica)
      data: { kind },
      loadComponent: () =>
        import('../Billing/components/billing-menu/billing-menu.component').then((m) => m.BillingMenuComponent),
    },
    {
      path: 'pending',
      data: { breadcrumb: 'Continuar Factura Pendiente', title: 'Continuar factura pendiente', kind },
      loadComponent: () =>
        import('../Billing/components/sale-invoice-pending/sale-invoice-pending.component').then(
          (m) => m.SaleInvoicePendingComponent,
        ),
    },
    {
      path: 'list',
      data: { breadcrumb: 'Ver Facturas', title: 'Ver facturas', kind },
      loadComponent: () =>
        import('../Billing/components/sale-invoice-list/sale-invoice-list.component').then(
          (m) => m.SaleInvoiceListComponent,
        ),
    },
    {
      path: 'returns',
      data: { breadcrumb: 'Facturas con Devolución', title: 'Facturas con devolución', kind },
      loadComponent: () =>
        import('../Billing/components/sale-return-list/sale-return-list.component').then(
          (m) => m.SaleReturnListComponent,
        ),
    },
    {
      path: 'new',
      data: { breadcrumb: cfg.newInvoiceTitle, title: cfg.newInvoiceTitle, kind },
      loadComponent: () =>
        import('../Billing/components/sale-invoice-form/sale-invoice-form.component').then(
          (m) => m.SaleInvoiceFormComponent,
        ),
    },
    {
      path: ':invoiceId/return/new',
      data: { breadcrumb: 'Nueva Devolución', title: cfg.newReturnTitle, kind },
      loadComponent: () =>
        import('../Billing/components/sale-return-form/sale-return-form.component').then(
          (m) => m.SaleReturnFormComponent,
        ),
    },
    {
      path: ':id',
      data: { breadcrumb: cfg.invoiceTitle, title: cfg.invoiceTitle, kind },
      loadComponent: () =>
        import('../Billing/components/sale-invoice-form/sale-invoice-form.component').then(
          (m) => m.SaleInvoiceFormComponent,
        ),
    },
  ];
}

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    // Sin esto la ruta vacía hereda el breadcrumb 'Facturación' de app.routes.ts y se duplica
    data: { breadcrumb: null },
    // Para pasar a HTTP: cambiar `useClass` por la implementación real (única línea a tocar)
    providers: [
      { provide: BillingSaleInvoiceApi, useClass: BillingHttpSaleInvoiceApi },
      { provide: BillingSaleReturnApi, useClass: BillingHttpSaleReturnApi },
      { provide: BillingProductCatalog, useClass: InventoryBillingProductCatalog },
      { provide: BillingCounterpartyCatalog, useClass: InventoryBillingCounterpartyCatalog },
      { provide: BillingPaymentCatalog, useClass: AccountingBillingPaymentCatalog },
      { provide: BillingTaxCatalog, useClass: GeneralMastersBillingTaxCatalog },
    ],
    children: [
      // Rutas viejas (marcadores guardados): llevan a la versión de venta
      { path: '', pathMatch: 'full', redirectTo: '/billing/sale' },
      { path: 'pending', redirectTo: '/billing/sale/pending' },
      { path: 'list', redirectTo: '/billing/sale/list' },
      { path: 'returns', redirectTo: '/billing/sale/returns' },
      // Compra y venta tienen cada una su hub; usan los mismos componentes y `data.kind` define el tipo
      {
        path: 'purchase',
        data: { breadcrumb: 'Factura de Compra', kind: 'PURCHASE' },
        children: kindRoutes('PURCHASE'),
      },
      {
        path: 'sale',
        data: { breadcrumb: 'Factura de Venta', kind: 'SALE' },
        children: kindRoutes('SALE'),
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
    ],
  },
];
