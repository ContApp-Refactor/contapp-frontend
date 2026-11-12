import { Observable } from 'rxjs';

export interface BillingTax {
  id: string;
  name: string;
  /** Tarifa en % (p. ej. 19). Opcional. */
  rate?: number;
}

// Contrato del catálogo de impuestos de la empresa que usa el formulario de factura (token de DI).
export abstract class BillingTaxCatalog {
  /** Impuestos de la empresa. Un error se propaga: no es lo mismo que "no hay impuestos". */
  abstract getTaxes(): Observable<BillingTax[]>;
}
