import { Observable } from 'rxjs';
import { BillingPaymentMethod } from '../models/billing-sale-invoice.model';

// Contrato del catálogo de pago que usa la factura de VENTA (token de DI, como BillingProductCatalog):
// billing.routes.ts decide la implementación.
export abstract class BillingPaymentCatalog {
  /** Métodos de pago ACTIVOS de la empresa. Un error (permisos, red) se propaga: no es lo mismo que "no hay métodos". */
  abstract getPaymentMethods(): Observable<BillingPaymentMethod[]>;
}
