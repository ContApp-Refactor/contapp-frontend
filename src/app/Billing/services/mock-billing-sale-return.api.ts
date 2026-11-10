import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, map, of, switchMap } from 'rxjs';
import { SaleInvoice } from '../models/billing-sale-invoice.model';
import {
  InvoiceWithReturnsSummary,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnDraftInput,
} from '../models/billing-sale-return.model';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { concurrentModificationError } from '../utils/billing-error';
import { calcTotals, roundQty } from '../utils/money';
import { buildAvailability, calcReturnTotals, deriveReturnState } from '../utils/sale-return';
import { BillingSaleInvoiceApi } from './billing-sale-invoice.api';
import { BillingSaleReturnApi } from './billing-sale-return.api';
import { nextReturnNumber, readSaleReturns, writeSaleReturns } from './sale-return-store';

const LATENCY_MS = 200;

// Implementación simulada: persiste en localStorage (clave billing_sale_returns). Los datos de la
// factura original se leen por BillingSaleInvoiceApi; la factura nunca se modifica desde aquí.
// Sirve a devoluciones de venta y de compra: las reglas son idénticas, solo cambia el `kind` heredado
// de la factura original (que define la numeración).
// Reglas alineadas con el back: las líneas se identifican por lineNo de la original, la cantidad es > 0 (hasta 3
// decimales, no necesariamente entera), emitir dos veces devuelve el documento y `version` se verifica solo si llega.
// No es fiel en: los `totals` y el `ordinal` se calculan aquí con las líneas; no hay transacciones ni concurrencia real.
@Injectable()
export class MockBillingSaleReturnApi extends BillingSaleReturnApi {
  private readonly invoices = inject(BillingSaleInvoiceApi);
  private readonly storage = inject(LocalStorageMethods);

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
        this.assertVersion(saleReturn, input.version);
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
          clientDocument: invoice.clientDocument ?? null,
          supplierInvoiceNumber: invoice.supplierInvoiceNumber,
          date: input.date,
          reason: '',
          lines: [],
          createdAt: now,
          updatedAt: now,
          version: 0,
        };
        all.push(saleReturn);
      }

      // Las líneas salen SIEMPRE de la factura original: precio e IVA congelados, el front solo envía lineNo y cantidad
      const availability = buildAvailability(invoice.lines, all.filter((r) => r.invoiceId === invoice.id && r.id !== saleReturn.id));
      const seen = new Set<number>();
      saleReturn.lines = input.lines.map((l) => {
        const a = availability.find((x) => x.lineNo === l.lineNo);
        if (!a) throw new Error(`La factura no tiene la línea ${l.lineNo}.`);
        if (!seen.add(l.lineNo)) throw new Error(`La línea ${l.lineNo} de la factura original está repetida.`);
        // Igual que el back (Quantity / @Positive): estrictamente positiva y con máximo 3 decimales
        if (!(l.cantidad > 0)) throw new Error('La cantidad a devolver debe ser mayor que cero.');
        if (roundQty(l.cantidad) !== l.cantidad) throw new Error('La cantidad admite máximo 3 decimales.');
        if (l.cantidad > a.available) {
          throw new Error(`No puedes devolver más de lo disponible de ${a.productName} (${a.available}).`);
        }
        return {
          sourceLineNo: a.lineNo,
          productId: a.productId,
          productName: a.productName,
          cantidadVendida: a.sold,
          cantidadDevuelta: l.cantidad,
          precioUnitarioCents: a.precioUnitarioCents,
          ivaPct: a.ivaPct,
          ...(a.taxes?.length ? { taxes: a.taxes } : {}), // hereda el desglose de la línea original
        };
      });
      saleReturn.date = input.date;
      saleReturn.reason = input.reason ?? '';
      saleReturn.updatedAt = now;
      saleReturn.version = (saleReturn.version ?? 0) + 1;

      writeSaleReturns(all);
      return of(structuredClone(saleReturn)).pipe(delay(LATENCY_MS));
    });
  }

  deleteDraft(id: string, version?: number | null): Observable<void> {
    return defer(() => {
      const all = readSaleReturns();
      const draft = this.findOrThrow(all, id);
      this.assertDraft(draft);
      this.assertVersion(draft, version);
      writeSaleReturns(all.filter((r) => r.id !== id));
      return of(void 0).pipe(delay(LATENCY_MS));
    });
  }

  emit(id: string, version?: number | null): Observable<SaleReturn> {
    // La factura original debe seguir EMITIDA (pudo anularse mientras la devolución era borrador)
    return defer(() => {
      const draft = this.findOrThrow(readSaleReturns(), id);
      // Como el back: emitir dos veces es idempotente y devuelve el documento ya emitido
      if (draft.status === 'EMITIDA') return of(structuredClone(draft)).pipe(delay(LATENCY_MS));
      return this.invoices.getById(draft.invoiceId).pipe(switchMap((invoice) => this.writeEmit(id, invoice, version)));
    });
  }

  private writeEmit(id: string, invoice: SaleInvoice, version?: number | null): Observable<SaleReturn> {
    return defer(() => {
      const all = readSaleReturns();
      const saleReturn = this.findOrThrow(all, id);
      this.assertDraft(saleReturn);
      this.assertVersion(saleReturn, version);

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
      // RN-06: el emisor se congela al emitir (igual que la factura)
      const enterprise = this.storage.loadEnterpriseData();
      saleReturn.issuer = {
        enterpriseId: enterprise?.id ?? '',
        name: enterprise?.name || 'Empresa',
        nit: enterprise?.nit ?? '',
        dv: null,
        active: true,
      };
      saleReturn.totals = calcReturnTotals(saleReturn.lines);
      saleReturn.version = (saleReturn.version ?? 0) + 1;

      writeSaleReturns(all);
      return of(structuredClone(saleReturn)).pipe(delay(LATENCY_MS));
    });
  }

  annul(id: string, reason: string, version?: number | null): Observable<SaleReturn> {
    return defer(() => {
      const all = readSaleReturns();
      const saleReturn = this.findOrThrow(all, id);
      // Como el back: anular una devolución ya ANULADA es idempotente (devuelve el documento, sin verificar la versión)
      if (saleReturn.status === 'ANULADA') return of(structuredClone(saleReturn)).pipe(delay(LATENCY_MS));
      this.assertVersion(saleReturn, version);
      if (saleReturn.status !== 'EMITIDA') throw new Error('Solo se pueden anular devoluciones emitidas.');
      if (!reason?.trim()) throw new Error('El motivo de anulación es obligatorio.');

      // Al pasar a ANULADA deja de contar en "ya devuelto": las cantidades quedan libres
      const now = new Date().toISOString();
      saleReturn.status = 'ANULADA';
      saleReturn.annulReason = reason.trim();
      saleReturn.annulledAt = now;
      saleReturn.updatedAt = now;
      saleReturn.version = (saleReturn.version ?? 0) + 1;

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

  // Bloqueo optimista: solo se verifica si llega una versión (como el back)
  private assertVersion(saleReturn: SaleReturn, version?: number | null): void {
    if (version != null && version !== (saleReturn.version ?? 0)) throw concurrentModificationError();
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
