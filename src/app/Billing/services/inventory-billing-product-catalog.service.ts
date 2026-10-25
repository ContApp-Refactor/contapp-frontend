import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingProductCatalog } from './billing-product-catalog';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';

interface ProductApiItem {
  id: number;
  code: string;
  name: string;
  cost?: number | null;
}

interface ProductApiPage {
  content: ProductApiItem[];
}

@Injectable()
export class InventoryBillingProductCatalog extends BillingProductCatalog {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly apiUrl = '/api/products/findActivate';

  getProducts(kind: DocumentKind): Observable<BillingProduct[]> {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      return of([]);
    }
    const params = new HttpParams().set('enterpriseId', enterpriseId).set('size', '1000');
    return this.http.get<ProductApiPage>(this.apiUrl, { params }).pipe(
      map(page =>
        page.content.map(p => ({
          id: String(p.id),
          code: p.code,
          name: p.name,
          // El backend no tiene precio de venta ni IVA: el precio se deriva de cost (provisional).
          priceCents: Math.round((p.cost ?? 0) * 100),
          ivaPct: 0,
        }))
      )
    );
  }
}
