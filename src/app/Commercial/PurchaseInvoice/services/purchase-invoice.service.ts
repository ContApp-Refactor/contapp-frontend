import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PurchaseInvoicePayload } from '../models/purchase-invoice-payload';

@Injectable({ providedIn: 'root' })
export class PurchaseInvoiceService {
  private readonly apiUrl = `${environment.API_URL}factures/skeleton/purchase`;

  constructor(private readonly http: HttpClient) {}

  createPurchaseInvoice(payload: PurchaseInvoicePayload): Observable<unknown> {
    return this.http.post(this.apiUrl, payload);
  }
}
