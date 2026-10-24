import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingProductCatalog } from './billing-product-catalog';

@Injectable()
export class InventoryBillingProductCatalog extends BillingProductCatalog {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/inventory/products';

  getProducts(kind: DocumentKind): Observable<BillingProduct[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(products =>
        products.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          priceCents: kind === 'SALE' ? p.salePrice : p.purchasePrice,
          ivaPct: p.ivaPct || 0,
        }))
      )
    );
  }
}
