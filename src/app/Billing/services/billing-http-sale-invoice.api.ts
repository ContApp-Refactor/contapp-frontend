import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { InvoiceStatus, SaleInvoice, SaleInvoiceDraftInput } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingSaleInvoiceApi, InvoiceListResult } from './billing-sale-invoice.api';
import { BillingDocumentKindRegistry, INVOICE_BASE } from './billing-document-kind-registry';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { IDEMPOTENCY_HEADER, IdempotencyKeyStore } from './idempotency-key.store';
import { paymentBody } from '../utils/payment';

const KINDS: DocumentKind[] = ['SALE', 'PURCHASE'];

// Override de IVA de una línea: null = sigue al catálogo. Con `ivaEditado` (del back o marcado por el formulario)
// manda esa bandera, así un override que casualmente coincide con la referencia no se pierde; sin bandera
// (línea nueva) se considera editado solo si difiere de la referencia conocida.
const ivaOverride = (l: SaleInvoiceDraftInput['lines'][number]): number | null => {
  if (l.ivaPct == null) return null;
  if (l.ivaEditado !== undefined) return l.ivaEditado ? l.ivaPct : null;
  return l.ivaCatalogoPct != null && l.ivaPct === l.ivaCatalogoPct ? null : l.ivaPct;
};

// Override de precio de una línea: misma regla que el IVA. Con `precioEditado` (del back o marcado por el formulario)
// manda esa bandera, así un override igual al catálogo no se pierde; sin bandera (línea nueva) se considera editado solo
// si difiere de la referencia de catálogo conocida.
const precioOverride = (l: SaleInvoiceDraftInput['lines'][number]): number | null => {
  if (l.precioEditado !== undefined) return l.precioEditado ? l.precioUnitarioCents : null;
  return l.precioCatalogoCents !== undefined && l.precioUnitarioCents === l.precioCatalogoCents
    ? null
    : l.precioUnitarioCents;
};

// El back acepta el id del impuesto como número o string; los ids numéricos viajan como número
const withholdingTaxIdBody = (taxId: string | number): string | number => {
  const n = typeof taxId === 'number' ? taxId : Number(taxId);
  return Number.isSafeInteger(n) && String(n) === String(taxId).trim() ? n : taxId;
};

// Cuerpo del borrador. Regla de precio: "lo editado prevalece; sin editar sigue al catálogo".
// Una línea sin editar se envía con precio null y el back la sigue al catálogo (se refresca al leer el borrador y se
// congela al emitir); si el usuario lo editó (`precioEditado`), viaja el valor como override aunque coincida con el
// catálogo. El IVA sigue la misma regla: el back es la fuente de verdad (lo resuelve desde la categoría del producto) y
// solo viaja ivaPct cuando el usuario lo editó.
// Sin dato (null) nunca se envía un valor inventado.
//
// Pago: lo envían ambas facturas (venta y compra): { methodId }.
export const toDraftBody = (input: SaleInvoiceDraftInput) => {
  const { payment, withholdings, ...rest } = input;
  return {
    ...rest,
    payment: paymentBody(payment),
    // Retenciones: reemplazo total. Ausente = no se toca (el form siempre manda la lista, `[]` las quita)
    ...(withholdings ? { withholdings: withholdings.map((w) => ({ code: w.code, taxId: withholdingTaxIdBody(w.taxId) })) } : {}),
    lines: input.lines.map((l) => ({
      productId: l.productId,
      cantidad: l.cantidad,
      precioUnitarioCents: precioOverride(l),
      ivaPct: ivaOverride(l),
    })),
    version: input.version ?? null, // bloqueo optimista: el back lo verifica solo si viene
  };
};

// Más recientes primero (el listado mezcla ventas y compras)
const byUpdatedDesc = (a: SaleInvoice, b: SaleInvoice): number =>
  (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);

@Injectable()
export class BillingHttpSaleInvoiceApi extends BillingSaleInvoiceApi {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly registry = inject(BillingDocumentKindRegistry);
  private readonly idempotency = inject(IdempotencyKeyStore);

  private getEnterpriseId(): string {
    return this.localStorageMethods.getIdEnterprise();
  }

  private params(): HttpParams {
    return new HttpParams().set('enterpriseId', this.getEnterpriseId());
  }

  private fetchOf(kind: DocumentKind, id: string): Observable<SaleInvoice> {
    return this.http
      .get<SaleInvoice>(`${INVOICE_BASE[kind]}/${id}`, { params: this.params() })
      .pipe(tap((invoice) => this.registry.remember(invoice.id, kind)));
  }

  // Un id de otro tipo responde 404 (el back lo trata como inexistente), por eso se prueba venta y luego compra
  private resolveKind(id: string): Observable<DocumentKind> {
    const known = this.registry.kindOf(id);
    return known ? of(known) : this.getById(id).pipe(map(() => this.registry.kindOf(id) ?? 'SALE'));
  }

  list(status?: InvoiceStatus): Observable<SaleInvoice[]> {
    return this.listWithSkipped(status).pipe(map((result) => result.items));
  }

  override listWithSkipped(status?: InvoiceStatus): Observable<InvoiceListResult> {
    let params = this.params();
    if (status) {
      params = params.set('status', status);
    }
    // El listado del back es un resumen sin líneas; las pantallas necesitan la factura completa
    return forkJoin(
      KINDS.map((kind) =>
        this.http
          .get<{ id: string }[]>(INVOICE_BASE[kind], { params })
          .pipe(map((summaries) => summaries.map((s) => ({ id: s.id, kind })))),
      ),
    ).pipe(
      map((groups) => groups.flat()),
      tap((summaries) => summaries.forEach((s) => this.registry.remember(s.id, s.kind))),
      switchMap((summaries) => this.hydrate(summaries)),
    );
  }

  // Hidratación tolerante: un documento que falla (404 por borrador eliminado entre medio, 500) se omite y se
  // reporta en consola, sin tumbar el listado. Se devuelve cuántos se omitieron por error para avisar al usuario
  // (un 404 no cuenta: el documento ya no existe, no es una falla). Si fallan todos por algo distinto de 404 se
  // propaga el primer error que NO sea 404 (el representativo, no un 404 arbitrario).
  private hydrate(summaries: { id: string; kind: DocumentKind }[]): Observable<InvoiceListResult> {
    if (summaries.length === 0) return of<InvoiceListResult>({ items: [], skipped: 0 });
    const failures: unknown[] = [];
    return forkJoin(
      summaries.map((s) =>
        this.fetchOf(s.kind, s.id).pipe(
          catchError((err: unknown) => {
            failures.push(err);
            console.warn(`Facturación: se omitió el documento ${s.id} del listado.`, err);
            return of<SaleInvoice | null>(null);
          }),
        ),
      ),
    ).pipe(
      map((items) => {
        const loaded = items.filter((i): i is SaleInvoice => i !== null);
        const real = failures.filter((f) => !(f instanceof HttpErrorResponse && f.status === 404));
        if (loaded.length === 0 && real.length > 0) throw real[0];
        return { items: loaded.sort(byUpdatedDesc), skipped: real.length };
      }),
    );
  }

  getById(id: string): Observable<SaleInvoice> {
    const known = this.registry.kindOf(id);
    if (known) {
      return this.fetchOf(known, id);
    }
    return this.fetchOf('SALE', id).pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 404 ? this.fetchOf('PURCHASE', id) : throwError(() => err),
      ),
    );
  }

  saveDraft(input: SaleInvoiceDraftInput): Observable<SaleInvoice> {
    const params = this.params();
    const kind = input.id ? (this.registry.kindOf(input.id) ?? input.kind) : input.kind;
    const body = toDraftBody(input);
    if (input.id) {
      return this.http
        .put<SaleInvoice>(`${INVOICE_BASE[kind]}/${input.id}`, body, { params })
        .pipe(tap((invoice) => this.registry.remember(invoice.id, kind)));
    }
    // Creación idempotente: la clave se toma al suscribir. Si el intento anterior terminó sin respuesta (resultado
    // desconocido) se reenvía el cuerpo ORIGINAL con la misma clave (replay: el back devuelve el mismo documento) y
    // luego un PUT aplica el cuerpo nuevo con la versión del documento creado (ver IdempotencyKeyStore).
    return this.idempotency.create<SaleInvoice>(
      `invoice:${kind}`,
      body,
      (key, sent) =>
        this.http
          .post<SaleInvoice>(INVOICE_BASE[kind], sent, { params, headers: { [IDEMPOTENCY_HEADER]: key } })
          .pipe(tap((invoice) => this.registry.remember(invoice.id, kind))),
      (created) =>
        this.http
          .put<SaleInvoice>(`${INVOICE_BASE[kind]}/${created.id}`, { ...body, version: created.version ?? null }, { params })
          .pipe(tap((invoice) => this.registry.remember(invoice.id, kind))),
    );
  }

  // La versión viaja por query en DELETE y en el cuerpo en emit/annul (así la lee el back)
  deleteDraft(id: string, version?: number | null): Observable<void> {
    return this.resolveKind(id).pipe(
      switchMap((kind) => {
        let params = this.params();
        if (version != null) params = params.set('version', String(version));
        return this.http.delete<void>(`${INVOICE_BASE[kind]}/${id}`, { params });
      }),
    );
  }

  emit(id: string, version?: number | null): Observable<SaleInvoice> {
    return this.resolveKind(id).pipe(
      switchMap((kind) =>
        this.http.post<SaleInvoice>(
          `${INVOICE_BASE[kind]}/${id}/emit`,
          version != null ? { version } : {},
          { params: this.params() },
        ),
      ),
    );
  }

  annul(id: string, reason: string, version?: number | null): Observable<SaleInvoice> {
    return this.resolveKind(id).pipe(
      switchMap((kind) =>
        this.http.post<SaleInvoice>(
          `${INVOICE_BASE[kind]}/${id}/annul`,
          version != null ? { reason, version } : { reason },
          { params: this.params() },
        ),
      ),
    );
  }
}
