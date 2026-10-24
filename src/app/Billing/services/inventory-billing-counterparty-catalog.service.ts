import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BillingClient } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';

@Injectable()
export class InventoryBillingCounterpartyCatalog extends BillingCounterpartyCatalog {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/general-masters/third-parties';

  getCounterparties(kind: DocumentKind): Observable<BillingClient[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(parties =>
        parties.map(p => ({
          id: p.id,
          name: p.name || p.businessName,
          document: p.documentNumber || p.nit,
        }))
      )
    );
  }
}
