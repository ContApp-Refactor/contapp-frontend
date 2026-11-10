import { Observable } from 'rxjs';
import { BillingClient } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';

// Contrato del catálogo de contrapartes de Facturación (token de DI, como BillingProductCatalog):
// todos los terceros activos (en venta y en compra), con su categoría. billing.routes.ts decide la implementación.
export abstract class BillingCounterpartyCatalog {
  abstract getCounterparties(kind: DocumentKind): Observable<BillingClient[]>;
}
