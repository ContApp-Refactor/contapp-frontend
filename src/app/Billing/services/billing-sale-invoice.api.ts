import { Observable, map } from 'rxjs';
import { InvoiceStatus, SaleInvoice, SaleInvoiceDraftInput } from '../models/billing-sale-invoice.model';

/** Resultado del listado: documentos cargados y cuántos se omitieron por fallar al hidratarlos. */
export interface InvoiceListResult {
  items: SaleInvoice[];
  skipped: number;
}

// Contrato de acceso a datos de facturas de venta y de compra (el tipo va en `kind`).
// Se usa como token de DI: para pasar de mock a HTTP basta cambiar el `useClass` en billing.routes.ts.
// Los clientes/proveedores salen de BillingCounterpartyCatalog.
export abstract class BillingSaleInvoiceApi {
  /** Facturas de ambos tipos; el filtro por tipo lo aplica quien consume. */
  abstract list(status?: InvoiceStatus): Observable<SaleInvoice[]>;
  /** Como `list`, pero informa cuántos documentos se omitieron por error (para avisar al usuario). Por defecto: ninguno. */
  listWithSkipped(status?: InvoiceStatus): Observable<InvoiceListResult> {
    return this.list(status).pipe(map((items) => ({ items, skipped: 0 })));
  }
  abstract getById(id: string): Observable<SaleInvoice>;

  /** Crea o actualiza un borrador (solo válido mientras esté en BORRADOR). */
  abstract saveDraft(input: SaleInvoiceDraftInput): Observable<SaleInvoice>;
  /** `version` (opcional): bloqueo optimista; si viene y ya no es la vigente el back responde 409. */
  abstract deleteDraft(id: string, version?: number | null): Observable<void>;

  /** BORRADOR -> EMITIDA: valida y asigna el número consecutivo (FV- venta, FC- compra). Emitir dos veces devuelve el documento. */
  abstract emit(id: string, version?: number | null): Observable<SaleInvoice>;
  /** EMITIDA -> ANULADA: requiere motivo. */
  abstract annul(id: string, reason: string, version?: number | null): Observable<SaleInvoice>;
}
