import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingProductCatalog } from './billing-product-catalog';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';

interface ProductApiItem {
  id: number;
  code: string;
  name: string;
  cost?: number | null;
  categoryId?: number | null;
}

interface ProductApiPage {
  content: ProductApiItem[];
}

// GET /api/categories/findActivate: la categoría trae los ids de sus impuestos (`taxes`)
interface CategoryApiItem {
  id: number;
  taxes?: number[] | null;
}

interface CategoryApiPage {
  content: CategoryApiItem[];
}

// GET /api/tax/active/{enterpriseId}: `interest` es el porcentaje del impuesto
interface TaxApiItem {
  id: number;
  code?: string | null;
  description?: string | null;
  interest?: number | null;
}

// Misma decisión que el back: el maestro de impuestos no tiene "tipo", así que el % de la categoría es la SUMA de las
// tarifas de todos sus impuestos. Sin impuestos o con total fuera de 0..100 => null ("—"); el back aplica su valor por defecto.
export const resolveCategoryIva = (categoryTaxes: TaxApiItem[]): number | null => {
  if (categoryTaxes.length === 0) return null;
  const rate = categoryTaxes.reduce((sum, t) => sum + Number(t.interest ?? 0), 0);
  return rate >= 0 && rate <= 100 ? Math.round(rate * 100) / 100 : null;
};

@Injectable()
export class InventoryBillingProductCatalog extends BillingProductCatalog {
  private readonly http = inject(HttpClient);
  private readonly localStorageMethods = inject(LocalStorageMethods);
  private readonly apiUrl = '/api/products/findActivate';
  private readonly categoriesUrl = '/api/categories/findActivate';
  private readonly taxesUrl = '/api/tax/active';

  getProducts(kind: DocumentKind): Observable<BillingProduct[]> {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      return of([]);
    }
    const params = new HttpParams().set('enterpriseId', enterpriseId).set('size', '1000');
    return forkJoin({
      products: this.http.get<ProductApiPage>(this.apiUrl, { params }),
      ivaByCategory: this.ivaByCategory(enterpriseId),
    }).pipe(
      map(({ products, ivaByCategory }) =>
        products.content.map(p => ({
          id: String(p.id),
          code: p.code,
          name: p.name,
          // El backend no tiene precio de venta: el precio se deriva de cost (provisional).
          priceCents: Math.round((p.cost ?? 0) * 100),
          // VISTA PREVIA del IVA de la categoría para líneas aún no guardadas; el back es la fuente de verdad.
          // null = sin dato (sin categoría, sin IVA identificable o consulta fallida): nunca se asume 0.
          ivaPct: (p.categoryId != null ? ivaByCategory.get(p.categoryId) : undefined) ?? null,
        }))
      )
    );
  }

  // categoryId -> % de IVA. Si categorías o impuestos fallan (permisos, red) el mapa queda vacío y los productos sin dato
  private ivaByCategory(enterpriseId: string): Observable<Map<number, number>> {
    const categoryParams = new HttpParams().set('enterpriseId', enterpriseId).set('size', '1000');
    return forkJoin({
      categories: this.http.get<CategoryApiPage>(this.categoriesUrl, { params: categoryParams }).pipe(
        map(page => page.content),
        catchError(() => of<CategoryApiItem[]>([]))
      ),
      taxes: this.http.get<TaxApiItem[]>(`${this.taxesUrl}/${enterpriseId}`).pipe(
        catchError(() => of<TaxApiItem[]>([]))
      ),
    }).pipe(
      map(({ categories, taxes }) => {
        const result = new Map<number, number>();
        for (const c of categories) {
          const ofCategory = taxes.filter(t => (c.taxes ?? []).includes(t.id));
          const iva = resolveCategoryIva(ofCategory);
          if (iva !== null) result.set(c.id, iva);
        }
        return result;
      })
    );
  }
}
