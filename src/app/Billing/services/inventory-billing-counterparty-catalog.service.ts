import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { BillingClient } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';

interface ThirdApiItem {
  thId: number;
  names?: string | null;
  lastNames?: string | null;
  socialReason?: string | null;
  idNumber?: number | null;
  state: boolean;
  thirdTypes?: { thirdTypeName?: string | null }[] | null;
}

interface ThirdApiPage {
  content: ThirdApiItem[];
}

// Categorías (tipos) del tercero unidas con "/": "Cliente/Proveedor"
const categoryOf = (p: ThirdApiItem): string =>
  (p.thirdTypes ?? [])
    .map(t => (t.thirdTypeName ?? '').trim())
    .filter(Boolean)
    .join('/');

@Injectable()
export class InventoryBillingCounterpartyCatalog extends BillingCounterpartyCatalog {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly apiUrl = '/api/thirds/';

  getCounterparties(kind: DocumentKind): Observable<BillingClient[]> {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      return of([]);
    }
    const params = new HttpParams()
      .set('entId', enterpriseId)
      .set('size', '1000')
      .set('sortField', 'names')
      .set('sortOrder', 'asc');
    return this.http.get<ThirdApiPage>(this.apiUrl, { params }).pipe(
      map(page =>
        // Venta y compra listan TODOS los terceros activos (sin filtrar por tipo); `kind` se conserva por el contrato
        page.content
          .filter(p => p.state)
          .map(p => ({
            id: String(p.thId),
            name: p.socialReason?.trim() ? p.socialReason : `${p.names ?? ''} ${p.lastNames ?? ''}`.trim(),
            document: String(p.idNumber ?? ''),
            category: categoryOf(p),
          }))
      )
    );
  }
}
