import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InvoiceStatus, SaleInvoice, SaleInvoiceDraftInput } from '../models/billing-sale-invoice.model';
import { BillingSaleInvoiceApi } from './billing-sale-invoice.api';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';

@Injectable()
export class BillingHttpSaleInvoiceApi extends BillingSaleInvoiceApi {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly apiUrl = '/api/billing/sale-invoices';

  private getEnterpriseId(): string {
    return this.localStorageMethods.getIdEnterprise();
  }

  list(status?: InvoiceStatus): Observable<SaleInvoice[]> {
    let params = new HttpParams();
    params = params.set('enterpriseId', this.getEnterpriseId());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<SaleInvoice[]>(this.apiUrl, { params });
  }

  getById(id: string): Observable<SaleInvoice> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.get<SaleInvoice>(`${this.apiUrl}/${id}`, { params });
  }

  saveDraft(input: SaleInvoiceDraftInput): Observable<SaleInvoice> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    if (input.id) {
      return this.http.put<SaleInvoice>(`${this.apiUrl}/${input.id}`, input, { params });
    }
    return this.http.post<SaleInvoice>(this.apiUrl, input, { params });
  }

  deleteDraft(id: string): Observable<void> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
  }

  emit(id: string): Observable<SaleInvoice> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.post<SaleInvoice>(`${this.apiUrl}/${id}/emit`, {}, { params });
  }

  annul(id: string, reason: string): Observable<SaleInvoice> {
    const params = new HttpParams().set('enterpriseId', this.getEnterpriseId());
    return this.http.post<SaleInvoice>(`${this.apiUrl}/${id}/annul`, { reason }, { params });
  }
}
