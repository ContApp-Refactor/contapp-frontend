import { Observable } from 'rxjs';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';

// Contrato del catálogo de productos que usa Facturación. Se usa como token de DI
// (igual que BillingSaleInvoiceApi): billing.routes.ts decide la implementación.
export abstract class BillingProductCatalog {
  /**
   * Productos activos disponibles para facturar. `priceCents` es solo la VISTA PREVIA de la línea nueva
   * (se deriva de `cost` en ambos tipos). El valor real lo resuelve el back: para SALE el `cost` del producto;
   * para PURCHASE el último precio de compra del kardex (con `cost` de respaldo). Tras el primer guardado
   * (autosave) la línea adopta `precioCatalogoCents` / `precioUnitarioCents` de la respuesta.
   */
  abstract getProducts(kind: DocumentKind): Observable<BillingProduct[]>;
}
