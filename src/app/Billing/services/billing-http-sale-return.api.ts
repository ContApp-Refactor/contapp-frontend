import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { InvoiceStatus } from '../models/billing-sale-invoice.model';
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
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';

interface ReturnLineDto {
  sourceLineNo: number | null;
  productId: string;
  productName: string;
  cantidadDevuelta: number;
  precioUnitarioCents: number;
  ivaPct: number;
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
  date: string;
  reason: string | null;
  lines: ReturnLineDto[];
  createdAt: string;
  updatedAt: string;
  emittedAt: string | null;
  annulledAt: string | null;
  annulReason: string | null;
  version: number;
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

const toReturnLine = (l: ReturnLineDto): SaleReturnLine => ({
  productId: l.productId,
  productName: l.productName,
  cantidadDevuelta: Number(l.cantidadDevuelta),
  precioUnitarioCents: l.precioUnitarioCents,
  ivaPct: Number(l.ivaPct),
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
  date: r.date,
  reason: r.reason ?? '',
  lines: r.lines.map(toReturnLine),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  emittedAt: r.emittedAt ?? undefined,
  annulledAt: r.annulledAt ?? undefined,
  annulReason: r.annulReason ?? undefined,
});

@Injectable()
export class BillingHttpSaleReturnApi extends BillingSaleReturnApi {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly apiUrl = '/api/billing/sale-returns';
  private readonly invoicesUrl = '/api/billing/sale-invoices';

  private getEnterpriseId(): string {
    return this.localStorageMethods.getIdEnterprise();
  }

  private fetchAvailability(invoiceId: string): Observable<AvailabilityLineDto[]> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http
      .get<{ lines: AvailabilityLineDto[] }>(`${this.invoicesUrl}/${invoiceId}/return-availability`, { params })
      .pipe(map((res) => res.lines));
  }

  getAvailability(invoiceId: string): Observable<ReturnAvailabilityLine[]> {
    return this.fetchAvailability(invoiceId).pipe(
      map((lines) =>
        lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          sold: Number(l.sold),
          returned: Number(l.returned),
          available: Number(l.available),
          precioUnitarioCents: l.precioUnitarioCents,
          ivaPct: Number(l.ivaPct),
        })),
      ),
    );
  }

  listByInvoice(invoiceId: string): Observable<SaleReturn[]> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    // El listado del back es un resumen sin líneas; las pantallas necesitan la devolución completa
    return this.http.get<{ id: string }[]>(`${this.invoicesUrl}/${invoiceId}/returns`, { params }).pipe(
      switchMap((summaries) =>
        summaries.length ? forkJoin(summaries.map((s) => this.getById(s.id))) : of<SaleReturn[]>([]),
      ),
    );
  }

  listInvoicesWithReturns(): Observable<InvoiceWithReturnsSummary[]> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<InvoiceWithReturnsDto[]>(`${this.invoicesUrl}/with-returns`, { params }).pipe(
      map((rows) =>
        rows.map((r) => ({
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
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<ReturnDto>(`${this.apiUrl}/${id}`, { params }).pipe(map(toSaleReturn));
  }

  saveDraft(input: SaleReturnDraftInput): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    // El back identifica las líneas por el lineNo de la factura original, no por productId
    return this.fetchAvailability(input.invoiceId).pipe(
      switchMap((availability) => {
        const body = {
          invoiceId: input.invoiceId,
          date: input.date,
          reason: input.reason,
          lines: input.lines.map((l) => ({
            sourceLineNo: availability.find((a) => a.productId === l.productId)?.lineNo,
            cantidad: l.cantidad,
          })),
        };
        return input.id
          ? this.http.put<ReturnDto>(`${this.apiUrl}/${input.id}`, body, { params })
          : this.http.post<ReturnDto>(this.apiUrl, body, { params });
      }),
      map(toSaleReturn),
    );
  }

  deleteDraft(id: string): Observable<void> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
  }

  emit(id: string): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.post<ReturnDto>(`${this.apiUrl}/${id}/emit`, {}, { params }).pipe(map(toSaleReturn));
  }

  annul(id: string, reason: string): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.post<ReturnDto>(`${this.apiUrl}/${id}/annul`, { reason }, { params }).pipe(map(toSaleReturn));
  }
}
