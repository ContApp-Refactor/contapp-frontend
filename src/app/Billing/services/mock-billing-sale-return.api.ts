import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, map, of, switchMap } from 'rxjs';
import { SaleInvoice } from '../models/billing-sale-invoice.model';
import {
  InvoiceWithReturnsSummary,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnDraftInput,
} from '../models/billing-sale-return.model';
import { calcTotals } from '../utils/money';
import { buildAvailability, calcReturnTotals, deriveReturnState } from '../utils/sale-return';
import { BillingSaleInvoiceApi } from './billing-sale-invoice.api';
import { BillingSaleReturnApi } from './billing-sale-return.api';
import { nextReturnNumber, readSaleReturns, writeSaleReturns } from './sale-return-store';

const LATENCY_MS = 200;

// Implementación simulada: persiste en localStorage (clave billing_sale_returns). Los datos de la
// factura original se leen por BillingSaleInvoiceApi; la factura nunca se modifica desde aquí.
// Sirve a devoluciones de venta y de compra: las reglas son idénticas, solo cambia el `kind` heredado
// de la factura original (que define la numeración).
@Injectable()
export class MockBillingSaleReturnApi extends BillingSaleReturnApi {
  private readonly invoices = inject(BillingSaleInvoiceApi);

  getAvailability(invoiceId: string): Observable<ReturnAvailabilityLine[]> {
    return this.invoices.getById(invoiceId).pipe(
      map((invoice) => {
        this.assertEmitted(invoice);
        return buildAvailability(invoice.lines, this.returnsOf(invoiceId));
      }),
    );
  }

  listByInvoice(invoiceId: string): Observable<SaleReturn[]> {
    return defer(() => {
      const list = this.returnsOf(invoiceId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return of(list).pipe(delay(LATENCY_MS));
    });
  }

  listInvoicesWithReturns(): Observable<InvoiceWithReturnsSummary[]> {
    return this.invoices.list().pipe(
      map((invoices) => {
        const returns = readSaleReturns();
        const summaries: InvoiceWithReturnsSummary[] = [];
        for (const invoice of invoices) {
          const emitted = returns.filter((r) => r.invoiceId === invoice.id && r.status === 'EMITIDA');
          if (emitted.length === 0) continue;
          summaries.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            kind: invoice.kind,
            supplierInvoiceNumber: invoice.supplierInvoiceNumber,
            clientName: invoice.clientName,
            invoiceDate: invoice.date,
            invoiceTotalCents: calcTotals(invoice.lines).totalCents,
            returnsCount: emitted.length,
            returnedTotalCents: emitted.reduce((sum, r) => sum + calcReturnTotals(r.lines).totalCents, 0),
            state: deriveReturnState(invoice.lines, emitted),
          });
        }
        return summaries.sort((a, b) => (b.invoiceNumber ?? '').localeCompare(a.invoiceNumber ?? ''));
      }),
    );
  }

  getById(id: string): Observable<SaleReturn> {
    return defer(() => of(this.findOrThrow(readSaleReturns(), id)).pipe(delay(LATENCY_MS)));
  }

  saveDraft(input: SaleReturnDraftInput): Observable<SaleReturn> {
    return this.invoices
      .getById(input.invoiceId)
      .pipe(switchMap((invoice) => this.writeDraft(input, invoice)));
  }

  private writeDraft(input: SaleReturnDraftInput, invoice: SaleInvoice): Observable<SaleReturn> {
    return defer(() => {
      this.assertEmitted(invoice);
      const all = readSaleReturns();
      const now = new Date().toISOString();

      let saleReturn: SaleReturn;
      if (input.id) {
        saleReturn = this.findOrThrow(all, input.id);
        this.assertDraft(saleReturn);
      } else {
        saleReturn = {
          id: crypto.randomUUID(),
          number: null,
          status: 'BORRADOR',
          kind: invoice.kind,
          invoiceId: invoice.id,
          originalNumber: invoice.number,
          originalDate: invoice.date,
          clientId: invoice.clientId,
          clientName: invoice.clientName,
          supplierInvoiceNumber: invoice.supplierInvoiceNumber,
          date: input.date,
          reason: '',
          lines: [],
          createdAt: now,
          updatedAt: now,
        };
        all.push(saleReturn);
      }

      // Las líneas salen SIEMPRE de la factura original: precio e IVA congelados, el front solo envía cantidades
      const availability = buildAvailability(invoice.lines, all.filter((r) => r.invoiceId === invoice.id));
      for (const l of input.lines) {
        if (!availability.some((a) => a.productId === l.productId)) {
          throw new Error('El producto no pertenece a la factura original.');
        }
      }
      saleReturn.lines = availability.map((a) => {
        const cantidad = input.lines.find((l) => l.productId === a.productId)?.cantidad ?? 0;
        if (!Number.isInteger(cantidad) || cantidad < 0) {
          throw new Error(`La cantidad a devolver de ${a.productName} debe ser un entero mayor o igual a cero.`);
        }
        if (cantidad > a.available) {
          throw new Error(`No puedes devolver más de lo disponible de ${a.productName} (${a.available}).`);
        }
        return {
          productId: a.productId,
          productName: a.productName,
          cantidadVendida: a.sold,
          cantidadDevuelta: cantidad,
          precioUnitarioCents: a.precioUnitarioCents,
          ivaPct: a.ivaPct,
        };
      });
      saleReturn.date = input.date;
      saleReturn.reason = input.reason ?? '';
      saleReturn.updatedAt = now;

      writeSaleReturns(all);
      return of(structuredClone(saleReturn)).pipe(delay(LATENCY_MS));
    });
  }

  deleteDraft(id: string): Observable<void> {
    return defer(() => {
      const all = readSaleReturns();
      this.assertDraft(this.findOrThrow(all, id));
      writeSaleReturns(all.filter((r) => r.id !== id));
      return of(void 0).pipe(delay(LATENCY_MS));
    });
  }

  emit(id: string): Observable<SaleReturn> {
    // La factura original debe seguir EMITIDA (pudo anularse mientras la devolución era borrador)
    return defer(() => {
      const draft = this.findOrThrow(readSaleReturns(), id);
      return this.invoices.getById(draft.invoiceId).pipe(switchMap((invoice) => this.writeEmit(id, invoice)));
    });
  }

  private writeEmit(id: string, invoice: SaleInvoice): Observable<SaleReturn> {
    return defer(() => {
      const all = readSaleReturns();
      const saleReturn = this.findOrThrow(all, id);
      this.assertDraft(saleReturn);

      // Las mismas reglas que validará el backend real
      if (invoice.status !== 'EMITIDA') throw new Error('La factura original ya no está emitida.');
      if (!saleReturn.reason?.trim()) throw new Error('El motivo de la devolución es obligatorio.');
      if (!saleReturn.lines.some((l) => l.cantidadDevuelta > 0)) {
        throw new Error('La devolución debe tener al menos una línea con cantidad mayor a cero.');
      }
      // Disponibilidad vigente: otra devolución pudo emitirse después de crear este borrador
      const availability = buildAvailability(invoice.lines, all.filter((r) => r.invoiceId === invoice.id));
      for (const l of saleReturn.lines) {
        const available = availability.find((a) => a.productId === l.productId)?.available ?? 0;
        if (l.cantidadDevuelta > available) {
          throw new Error(`La cantidad de ${l.productName} supera lo disponible para devolver (${available}).`);
        }
      }

      const now = new Date().toISOString();
      saleReturn.number = nextReturnNumber(saleReturn.kind);
      saleReturn.status = 'EMITIDA';
      saleReturn.emittedAt = now;
      saleReturn.updatedAt = now;

      writeSaleReturns(all);
      return of(structuredClone(saleReturn)).pipe(delay(LATENCY_MS));
    });
  }

  annul(id: string, reason: string): Observable<SaleReturn> {
    return defer(() => {
      const all = readSaleReturns();
      const saleReturn = this.findOrThrow(all, id);
      if (saleReturn.status !== 'EMITIDA') throw new Error('Solo se pueden anular devoluciones emitidas.');
      if (!reason?.trim()) throw new Error('El motivo de anulación es obligatorio.');

      // Al pasar a ANULADA deja de contar en "ya devuelto": las cantidades quedan libres
      const now = new Date().toISOString();
      saleReturn.status = 'ANULADA';
      saleReturn.annulReason = reason.trim();
      saleReturn.annulledAt = now;
      saleReturn.updatedAt = now;

      writeSaleReturns(all);
      return of(structuredClone(saleReturn)).pipe(delay(LATENCY_MS));
    });
  }

  // --- helpers ---

  private returnsOf(invoiceId: string): SaleReturn[] {
    return readSaleReturns().filter((r) => r.invoiceId === invoiceId);
  }

  private findOrThrow(all: SaleReturn[], id: string): SaleReturn {
    const saleReturn = all.find((r) => r.id === id);
    if (!saleReturn) throw new Error('La devolución no existe.');
    return saleReturn;
  }

  private assertDraft(saleReturn: SaleReturn): void {
    if (saleReturn.status !== 'BORRADOR') {
      throw new Error('Solo los borradores se pueden modificar o eliminar.');
    }
  }

  private assertEmitted(invoice: SaleInvoice): void {
    if (invoice.status !== 'EMITIDA') throw new Error('Solo se pueden devolver facturas emitidas.');
  }
}
