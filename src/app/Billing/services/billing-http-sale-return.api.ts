import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  InvoiceWithReturnsSummary,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnDraftInput,
} from '../models/billing-sale-return.model';
import { BillingSaleReturnApi } from './billing-sale-return.api';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';

@Injectable()
export class BillingHttpSaleReturnApi extends BillingSaleReturnApi {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly apiUrl = '/api/billing/sale-returns';

  private getEnterpriseId(): string {
    return this.localStorageMethods.getIdEnterprise();
  }

  getAvailability(invoiceId: string): Observable<ReturnAvailabilityLine[]> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<ReturnAvailabilityLine[]>(`/api/billing/sale-invoices/${invoiceId}/availability`, { params });
  }

  listByInvoice(invoiceId: string): Observable<SaleReturn[]> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<SaleReturn[]>(`/api/billing/sale-invoices/${invoiceId}/returns`, { params });
  }

  listInvoicesWithReturns(): Observable<InvoiceWithReturnsSummary[]> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<InvoiceWithReturnsSummary[]>(`${this.apiUrl}/invoices-with-returns`, { params });
  }

  getById(id: string): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<SaleReturn>(`${this.apiUrl}/${id}`, { params });
  }

  saveDraft(input: SaleReturnDraftInput): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    if (input.id) {
      return this.http.put<SaleReturn>(`${this.apiUrl}/${input.id}`, input, { params });
    }
    return this.http.post<SaleReturn>(this.apiUrl, input, { params });
  }

  deleteDraft(id: string): Observable<void> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
  }

  emit(id: string): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.post<SaleReturn>(`${this.apiUrl}/${id}/emit`, {}, { params });
  }

  annul(id: string, reason: string): Observable<SaleReturn> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.post<SaleReturn>(`${this.apiUrl}/${id}/annul`, { reason }, { params });
  }
}
