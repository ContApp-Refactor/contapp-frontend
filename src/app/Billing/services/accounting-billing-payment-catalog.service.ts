import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { BillingPaymentMethod } from '../models/billing-sale-invoice.model';
import { BillingPaymentCatalog } from './billing-payment-catalog';

export const PAYMENT_CATALOG_BASE = '/api/billing/payment-catalog';

// Catálogo de pago real: endpoints propios de Billing (devuelve [{id, name}]).
@Injectable()
export class AccountingBillingPaymentCatalog extends BillingPaymentCatalog {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(LocalStorageMethods);

  private params(enterpriseId: string): HttpParams {
    return new HttpParams().set('enterpriseId', enterpriseId);
  }

  getPaymentMethods(): Observable<BillingPaymentMethod[]> {
    const enterpriseId = this.storage.getIdEnterprise();
    if (!enterpriseId) return of([]);
    return this.http
      .get<BillingPaymentMethod[]>(`${PAYMENT_CATALOG_BASE}/methods`, { params: this.params(enterpriseId) })
      .pipe(map((list) => (list ?? []).map((m) => ({ id: String(m.id), name: m.name }))));
  }
}
