import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AgingLine, Page, Payable, PayableWriteOff, PaymentSchedule, PaymentVoucher, ScheduleRequest, SupplierStatement, VoucherRequest, VoucherStatus, WriteOffRequest } from './treasury-api.models';

export function createTreasuryIdempotencyKey(
  randomUuid: (() => string) | null =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
      : null,
): string {
  return randomUuid?.() ?? `treasury-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class TreasuryApiService {
  private readonly base = `${environment.API_URL}treasury`;
  constructor(private readonly http: HttpClient) {}

  vouchers(enterpriseId: string, filter: Record<string, string | number | undefined> = {}): Observable<Page<PaymentVoucher>> {
    let params = new HttpParams().set('enterpriseId', enterpriseId);
    Object.entries(filter).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, value); });
    return this.http.get<Page<PaymentVoucher>>(`${this.base}/payment-vouchers`, { params });
  }
  voucher(id: number, enterpriseId: string) { return this.http.get<PaymentVoucher>(`${this.base}/payment-vouchers/${id}`, { params: { enterpriseId } }); }
  createVoucher(request: VoucherRequest) { return this.http.post<PaymentVoucher>(`${this.base}/payment-vouchers`, request); }
  updateVoucher(id: number, request: VoucherRequest) { return this.http.put<PaymentVoucher>(`${this.base}/payment-vouchers/${id}`, request); }
  deleteVoucher(id: number, enterpriseId: string) { return this.http.delete<void>(`${this.base}/payment-vouchers/${id}`, { params: { enterpriseId } }); }
  postVoucher(id: number, enterpriseId: string, key?: string) {
    const idempotencyKey = key || createTreasuryIdempotencyKey();
    return this.http.post<PaymentVoucher>(`${this.base}/payment-vouchers/${id}/post`, null,
      { params: { enterpriseId }, headers: new HttpHeaders().set('Idempotency-Key', idempotencyKey) });
  }
  voidVoucher(id: number, enterpriseId: string, reason: string) {
    return this.http.post<PaymentVoucher>(`${this.base}/payment-vouchers/${id}/void`, { reason }, { params: { enterpriseId } });
  }
  pending(enterpriseId: string, supplierId?: number) {
    let params = new HttpParams().set('enterpriseId', enterpriseId);
    if (supplierId != null) params = params.set('supplierId', supplierId);
    return this.http.get<Payable[]>(`${this.base}/payables/pending`, { params });
  }
  payable(id: number, enterpriseId: string) {
    return this.http.get<Payable>(`${this.base}/payables/${id}`, { params: { enterpriseId } });
  }
  changeDueDate(id: number, enterpriseId: string, dueDate: string, reason: string) {
    return this.http.patch<Payable>(`${this.base}/payables/${id}/due-date`, { dueDate, reason }, { params: { enterpriseId } });
  }
  schedules(enterpriseId: string) { return this.http.get<PaymentSchedule[]>(`${this.base}/payment-schedules`, { params: { enterpriseId } }); }
  schedule(id: number) { return this.http.get<PaymentSchedule>(`${this.base}/payment-schedules/${id}`); }
  createSchedule(request: ScheduleRequest) { return this.http.post<PaymentSchedule>(`${this.base}/payment-schedules`, request); }
  updateSchedule(id: number, request: ScheduleRequest) { return this.http.put<PaymentSchedule>(`${this.base}/payment-schedules/${id}`, request); }
  deleteSchedule(id: number) { return this.http.delete<void>(`${this.base}/payment-schedules/${id}`); }
  cancelSchedule(id: number) { return this.http.post<PaymentSchedule>(`${this.base}/payment-schedules/${id}/cancel`, null); }
  retrySchedule(id: number) { return this.http.post<PaymentSchedule>(`${this.base}/payment-schedules/${id}/retry`, null); }
  statement(enterpriseId: string, supplierId?: number, from?: string, to?: string, invoice?: string, active?: boolean) { let params = new HttpParams().set('enterpriseId', enterpriseId); if(supplierId!=null)params=params.set('supplierId',supplierId);if(from)params=params.set('from',from);if(to)params=params.set('to',to);if(invoice)params=params.set('invoice',invoice);if(active!=null)params=params.set('active',active);return this.http.get<SupplierStatement>(`${this.base}/reports/statement`, { params }); }
  aging(enterpriseId: string, cutoff: string, supplierId?: number, accountCode?: string, document?: string) {
    let params = new HttpParams().set('enterpriseId', enterpriseId).set('cutoff', cutoff);
    if (supplierId != null) params = params.set('supplierId', supplierId);
    if (accountCode) params = params.set('accountCode', accountCode);
    if (document) params = params.set('document', document);
    return this.http.get<AgingLine[]>(`${this.base}/reports/aging`, { params });
  }
  writeOffs(enterpriseId: string) {
    return this.http.get<PayableWriteOff[]>(`${this.base}/payable-write-offs`, { params: { enterpriseId } });
  }
  writeOff(id: number) {
    return this.http.get<PayableWriteOff>(`${this.base}/payable-write-offs/${id}`);
  }
  accountingEntry(sourceDocumentId: number, sourceType = 'PAYMENT_VOUCHER') {
    return this.http.get<any>(`${environment.API_URL}accountCatalogue/accounting/entries/by-source/${sourceDocumentId}/${sourceType}`);
  }
  createWriteOff(request: WriteOffRequest) {
    return this.http.post<PayableWriteOff>(`${this.base}/payable-write-offs`, request);
  }
  confirmWriteOff(id: number) {
    return this.http.post<PayableWriteOff>(`${this.base}/payable-write-offs/${id}/confirm`, null);
  }
  discardWriteOff(id: number) {
    return this.http.post<PayableWriteOff>(`${this.base}/payable-write-offs/${id}/discard`, null).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          return this.http.post<PayableWriteOff>(`${this.base}/payable-write-offs/${id}/void`, null);
        }
        return throwError(() => err);
      }),
    );
  }
  voidWriteOff(id: number) {
    return this.http.post<PayableWriteOff>(`${this.base}/payable-write-offs/${id}/void`, null);
  }
}
