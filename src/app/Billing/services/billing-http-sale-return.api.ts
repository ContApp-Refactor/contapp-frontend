import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { BillingIssuer, InvoiceStatus, InvoiceTotals } from '../models/billing-sale-invoice.model';
import { toLineTaxes } from '../utils/tax-breakdown';
import { DocumentKind } from '../models/document-kind';
import {
  InvoiceReturnState,
  InvoiceWithReturnsSummary,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnLine,
  SaleReturnDraftInput,
} from '../models/billing-sale-return.model';
import { BillingSaleReturnApi } from './billing-sale-return.api';
import { BillingDocumentKindRegistry, INVOICE_BASE, RETURN_BASE } from './billing-document-kind-registry';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { IDEMPOTENCY_HEADER, IdempotencyKeyStore } from './idempotency-key.store';

interface ReturnLineDto {
  sourceLineNo: number | null;
  productId: string;
  productName: string;
  cantidadDevuelta: number;
  precioUnitarioCents: number;
  ivaPct: number;
  subtotalCents?: number | null;
  taxes?: TaxDto[] | null; // desglose heredado de la línea original (ausente en back/documentos viejos)
}

interface TaxDto {
  name: string;
  rate: number | string;
}

interface ReturnDto {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  kind: DocumentKind;
  invoiceId: string;
  originalNumber: string | null;
  originalDate: string;
  clientId: string | null;
  clientName: string | null;
  clientDocument?: string | null;
  date: string;
  reason: string | null;
  lines: ReturnLineDto[];
  totals?: InvoiceTotals | null;
  createdAt: string;
  updatedAt: string;
  emittedAt: string | null;
  annulledAt: string | null;
  annulReason: string | null;
  version: number | null;
  issuer?: BillingIssuer | null;
}

interface AvailabilityLineDto {
  lineNo: number;
  productId: string;
  productName: string;
  sold: number;
  returned: number;
  available: number;
  precioUnitarioCents: number;
  ivaPct: number;
  taxes?: TaxDto[] | null;
}

interface InvoiceWithReturnsDto {
  invoiceId: string;
  invoiceNumber: string | null;
  kind: DocumentKind;
  supplierInvoiceNumber: string | null;
  clientName: string | null;
  invoiceDate: string;
  invoiceTotalCents: number;
  returnsCount: number;
  returnedTotalCents: number;
  state: InvoiceReturnState;
}

const KINDS: DocumentKind[] = ['SALE', 'PURCHASE'];

// Ámbito de la clave de idempotencia de la creación de devoluciones de una factura
const returnScope = (kind: DocumentKind, invoiceId: string): string => `return:${kind}:${invoiceId}`;

const toReturnLine = (l: ReturnLineDto): SaleReturnLine => ({
  sourceLineNo: l.sourceLineNo,
  productId: l.productId,
  productName: l.productName,
  cantidadDevuelta: Number(l.cantidadDevuelta),
  precioUnitarioCents: l.precioUnitarioCents,
  ivaPct: Number(l.ivaPct),
  ...(l.subtotalCents != null ? { subtotalCents: l.subtotalCents } : {}),
  ...(l.taxes?.length ? { taxes: toLineTaxes(l.taxes) } : {}),
});

const toSaleReturn = (r: ReturnDto): SaleReturn => ({
  id: r.id,
  number: r.number,
  status: r.status,
  kind: r.kind,
  invoiceId: r.invoiceId,
  originalNumber: r.originalNumber,
  originalDate: r.originalDate,
  clientId: r.clientId,
  clientName: r.clientName,
  clientDocument: r.clientDocument ?? null,
  date: r.date,
  reason: r.reason ?? '',
  lines: r.lines.map(toReturnLine),
  totals: r.totals ?? null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  emittedAt: r.emittedAt ?? undefined,
  annulledAt: r.annulledAt ?? undefined,
  annulReason: r.annulReason ?? undefined,
  version: r.version ?? null,
  issuer: r.issuer ?? null,
});

@Injectable()
export class BillingHttpSaleReturnApi extends BillingSaleReturnApi {
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

  // Un id de otro tipo responde 404 (el back lo trata como inexistente), por eso se prueba venta y luego compra
  private onKind<T>(id: string, call: (kind: DocumentKind) => Observable<T>): Observable<T> {
    const attempt = (kind: DocumentKind): Observable<T> =>
      call(kind).pipe(tap(() => this.registry.remember(id, kind)));
    const known = this.registry.kindOf(id);
    if (known) {
      return attempt(known);
    }
    return attempt('SALE').pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 404 ? attempt('PURCHASE') : throwError(() => err),
      ),
    );
  }

  private resolveReturnKind(returnId: string): Observable<DocumentKind> {
    const known = this.registry.kindOf(returnId);
    return known ? of(known) : this.getById(returnId).pipe(map(() => this.registry.kindOf(returnId) ?? 'SALE'));
  }

  private fetchAvailability(kind: DocumentKind, invoiceId: string): Observable<AvailabilityLineDto[]> {
    return this.http
      .get<{ lines: AvailabilityLineDto[] }>(`${INVOICE_BASE[kind]}/${invoiceId}/return-availability`, {
        params: this.params(),
      })
      .pipe(map((res) => res.lines));
  }

  private fetchReturn(kind: DocumentKind, id: string): Observable<SaleReturn> {
    return this.http.get<ReturnDto>(`${RETURN_BASE[kind]}/${id}`, { params: this.params() }).pipe(
      tap((r) => this.registry.remember(r.id, kind)),
      map(toSaleReturn),
    );
  }

  getAvailability(invoiceId: string): Observable<ReturnAvailabilityLine[]> {
    return this.onKind(invoiceId, (kind) => this.fetchAvailability(kind, invoiceId)).pipe(
      map((lines) =>
        lines.map((l) => ({
          lineNo: l.lineNo,
          productId: l.productId,
          productName: l.productName,
          sold: Number(l.sold),
          returned: Number(l.returned),
          available: Number(l.available),
          precioUnitarioCents: l.precioUnitarioCents,
          ivaPct: Number(l.ivaPct),
          ...(l.taxes?.length ? { taxes: toLineTaxes(l.taxes) } : {}),
        })),
      ),
    );
  }

  listByInvoice(invoiceId: string): Observable<SaleReturn[]> {
    // El listado del back es un resumen sin líneas; las pantallas necesitan la devolución completa
    return this.onKind(invoiceId, (kind) =>
      this.http
        .get<{ id: string }[]>(`${INVOICE_BASE[kind]}/${invoiceId}/returns`, { params: this.params() })
        .pipe(map((summaries) => ({ kind, summaries }))),
    ).pipe(
      switchMap(({ kind, summaries }) =>
        summaries.length ? forkJoin(summaries.map((s) => this.fetchReturn(kind, s.id))) : of<SaleReturn[]>([]),
      ),
    );
  }

  listInvoicesWithReturns(): Observable<InvoiceWithReturnsSummary[]> {
    return forkJoin(
      KINDS.map((kind) =>
        this.http
          .get<InvoiceWithReturnsDto[]>(`${INVOICE_BASE[kind]}/with-returns`, { params: this.params() })
          .pipe(tap((rows) => rows.forEach((r) => this.registry.remember(r.invoiceId, kind)))),
      ),
    ).pipe(
      map((groups) =>
        groups.flat().map((r) => ({
          invoiceId: r.invoiceId,
          invoiceNumber: r.invoiceNumber,
          kind: r.kind,
          supplierInvoiceNumber: r.supplierInvoiceNumber,
          clientName: r.clientName,
          invoiceDate: r.invoiceDate,
          invoiceTotalCents: r.invoiceTotalCents,
          returnsCount: r.returnsCount,
          returnedTotalCents: r.returnedTotalCents,
          state: r.state,
        })),
      ),
    );
  }

  getById(id: string): Observable<SaleReturn> {
    return this.onKind(id, (kind) => this.fetchReturn(kind, id));
  }

  // Tipo de la factura original: casi siempre ya está en el registro (la pantalla leyó antes la disponibilidad);
  // si no, se prueba consultando la disponibilidad (venta y luego compra)
  private invoiceKind(invoiceId: string): Observable<DocumentKind> {
    const known = this.registry.kindOf(invoiceId);
    if (known) return of(known);
    return this.onKind(invoiceId, (kind) => this.fetchAvailability(kind, invoiceId)).pipe(
      map(() => this.registry.kindOf(invoiceId) ?? 'SALE'),
    );
  }

  saveDraft(input: SaleReturnDraftInput): Observable<SaleReturn> {
    const params = this.params();
    // El back identifica las líneas por el lineNo de la factura original y exige cantidad > 0 (@Positive):
    // las líneas con 0 (producto que no se devuelve) no se envían. Sin líneas el borrador es válido (solo motivo/fecha).
    const body = {
      invoiceId: input.invoiceId,
      date: input.date,
      reason: input.reason,
      lines: input.lines.filter((l) => l.cantidad > 0).map((l) => ({ sourceLineNo: l.lineNo, cantidad: l.cantidad })),
    };
    return this.invoiceKind(input.invoiceId).pipe(
      switchMap((kind) => {
        if (input.id) {
          return this.http
            .put<ReturnDto>(`${RETURN_BASE[kind]}/${input.id}`, { ...body, version: input.version ?? null }, { params })
            .pipe(tap((r) => this.registry.remember(r.id, kind)));
        }
        // Creación idempotente: misma clave mientras el cuerpo no cambie (doble clic o reintento); tras un intento sin
        // respuesta se reenvía el cuerpo original con la misma clave y luego un PUT aplica el nuevo (ver IdempotencyKeyStore)
        return this.idempotency.create<ReturnDto>(
          returnScope(kind, input.invoiceId),
          body,
          (key, sent) =>
            this.http
              .post<ReturnDto>(RETURN_BASE[kind], sent, { params, headers: { [IDEMPOTENCY_HEADER]: key } })
              .pipe(tap((r) => this.registry.remember(r.id, kind))),
          (created) =>
            this.http
              .put<ReturnDto>(`${RETURN_BASE[kind]}/${created.id}`, { ...body, version: created.version ?? null }, { params })
              .pipe(tap((r) => this.registry.remember(r.id, kind))),
        );
      }),
      map(toSaleReturn),
    );
  }

  override forgetPendingCreation(invoiceId: string): void {
    for (const kind of KINDS) this.idempotency.forget(returnScope(kind, invoiceId));
  }

  // La versión viaja por query en DELETE y en el cuerpo en emit/annul (así la lee el back)
  deleteDraft(id: string, version?: number | null): Observable<void> {
    return this.resolveReturnKind(id).pipe(
      switchMap((kind) => {
        let params = this.params();
        if (version != null) params = params.set('version', String(version));
        return this.http.delete<void>(`${RETURN_BASE[kind]}/${id}`, { params });
      }),
    );
  }

  emit(id: string, version?: number | null): Observable<SaleReturn> {
    return this.resolveReturnKind(id).pipe(
      switchMap((kind) =>
        this.http.post<ReturnDto>(`${RETURN_BASE[kind]}/${id}/emit`, version != null ? { version } : {}, {
          params: this.params(),
        }),
      ),
      map(toSaleReturn),
    );
  }

  annul(id: string, reason: string, version?: number | null): Observable<SaleReturn> {
    return this.resolveReturnKind(id).pipe(
      switchMap((kind) =>
        this.http.post<ReturnDto>(
          `${RETURN_BASE[kind]}/${id}/annul`,
          version != null ? { reason, version } : { reason },
          { params: this.params() },
        ),
      ),
      map(toSaleReturn),
    );
  }
}
