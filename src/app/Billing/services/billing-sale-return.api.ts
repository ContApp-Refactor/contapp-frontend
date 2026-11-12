import { Observable } from 'rxjs';
import {
  InvoiceWithReturnsSummary,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnDraftInput,
} from '../models/billing-sale-return.model';

// Contrato de acceso a datos de devoluciones de venta y de compra (token de DI, igual que BillingSaleInvoiceApi).
// El tipo de la devolución es el de su factura original.
export abstract class BillingSaleReturnApi {
  /** Vendido / ya devuelto / disponible por producto. Solo para facturas EMITIDA. */
  abstract getAvailability(invoiceId: string): Observable<ReturnAvailabilityLine[]>;
  /** Todas las devoluciones (cualquier estado) de una factura. */
  abstract listByInvoice(invoiceId: string): Observable<SaleReturn[]>;
  /** Facturas con al menos una devolución EMITIDA, con conteo, total devuelto y estado. */
  abstract listInvoicesWithReturns(): Observable<InvoiceWithReturnsSummary[]>;
  abstract getById(id: string): Observable<SaleReturn>;

  /** Crea o actualiza un borrador (solo válido mientras esté en BORRADOR). Las líneas se envían por lineNo y con cantidad > 0. */
  abstract saveDraft(input: SaleReturnDraftInput): Observable<SaleReturn>;
  /** `version` (opcional): bloqueo optimista; si viene y ya no es la vigente el back responde 409. */
  abstract deleteDraft(id: string, version?: number | null): Observable<void>;
  /**
   * Olvida la clave de idempotencia de una creación sin respuesta para esa factura (se borraron los borradores que pudo
   * crear): el reintento debe crear uno nuevo y no hacer replay de uno ya borrado. Sin efecto en los mocks.
   */
  forgetPendingCreation(invoiceId: string): void {
    void invoiceId;
  }

  /** BORRADOR -> EMITIDA: valida y asigna el número consecutivo (NC- venta, DC- compra). Emitir dos veces devuelve el documento. */
  abstract emit(id: string, version?: number | null): Observable<SaleReturn>;
  // PENDIENTE DE DECISION (nota 15): la UI ya no ofrece anular una devolucion. Se conserva el contrato y el endpoint del
  // back hasta confirmar si se elimina o se deja; no lo uses desde pantallas sin esa confirmacion.
  /** EMITIDA -> ANULADA: requiere motivo. Libera las cantidades devueltas. */
  abstract annul(id: string, reason: string, version?: number | null): Observable<SaleReturn>;
}
