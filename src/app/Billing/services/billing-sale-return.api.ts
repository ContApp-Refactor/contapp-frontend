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

  /** Crea o actualiza un borrador (solo válido mientras esté en BORRADOR). */
  abstract saveDraft(input: SaleReturnDraftInput): Observable<SaleReturn>;
  abstract deleteDraft(id: string): Observable<void>;

  /** BORRADOR -> EMITIDA: valida y asigna el número consecutivo (NC- venta, DC- compra). */
  abstract emit(id: string): Observable<SaleReturn>;
  /** EMITIDA -> ANULADA: requiere motivo. Libera las cantidades devueltas. */
  abstract annul(id: string, reason: string): Observable<SaleReturn>;
}
