import { Observable } from 'rxjs';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';

// Contrato del catálogo de productos que usa Facturación. Se usa como token de DI
// (igual que BillingSaleInvoiceApi): billing.routes.ts decide la implementación.
export abstract class BillingProductCatalog {
  /**
   * Productos activos disponibles para facturar. `priceCents` es la referencia según el tipo:
   * precio de venta para SALE, costo (precio de compra) para PURCHASE.
   */
  abstract getProducts(kind: DocumentKind): Observable<BillingProduct[]>;
}
