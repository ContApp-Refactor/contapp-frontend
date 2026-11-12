import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BillingLineTax, BillingProduct } from '../models/billing-sale-invoice.model';
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

// Desglose de la categoría con la MISMA regla que el back (BillingVatRateResolver): un elemento por impuesto activo de la
// categoría, en el orden del maestro, con el código como nombre ("Iva"; sin código, la descripción). Si la suma cae fuera de
// 0..100 o no hay impuestos el back usa su valor por defecto y NO hay desglose => []. La suma sigue saliendo de
// resolveCategoryIva y es la que se usa para totales.
export const resolveCategoryTaxes = (categoryTaxes: TaxApiItem[]): BillingLineTax[] => {
  if (resolveCategoryIva(categoryTaxes) === null) return [];
  return categoryTaxes.map((t) => ({ name: taxName(t), rate: Math.round(Number(t.interest ?? 0) * 100) / 100 }));
};

const taxName = (t: TaxApiItem): string => {
  const code = t.code?.trim();
  if (code) return code;
  const description = t.description?.trim();
  return description || 'Impuesto';
};

interface CategoryVat {
  ivaPct: number;
  taxes: BillingLineTax[];
}

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
      vatByCategory: this.vatByCategory(enterpriseId),
    }).pipe(
      map(({ products, vatByCategory }) =>
        products.content.map(p => {
          const vat = p.categoryId != null ? vatByCategory.get(p.categoryId) : undefined;
          return {
            id: String(p.id),
            code: p.code,
            name: p.name,
            // El backend no tiene precio de venta: el precio se deriva de cost (provisional). En COMPRA es solo la vista
            // previa: el back sugiere el ÚLTIMO PRECIO DE COMPRA (kardex) con cost de respaldo, y el autosave de la línea
            // lo adopta de la respuesta (`precioCatalogoCents`). No se consulta el kardex por producto desde el front.
            priceCents: Math.round((p.cost ?? 0) * 100),
            // VISTA PREVIA del IVA de la categoría para líneas aún no guardadas; el back es la fuente de verdad.
            // null = sin dato (sin categoría, sin IVA identificable o consulta fallida): nunca se asume 0.
            ivaPct: vat?.ivaPct ?? null,
            // VISTA PREVIA del desglose ("Iva: 12%", "Ica: 6%"); [] = sin impuestos de categoría (casilla editable)
            taxes: vat?.taxes ?? [],
          };
        })
      )
    );
  }

  // categoryId -> % (suma) y desglose. Si categorías o impuestos fallan (permisos, red) el mapa queda vacío y los productos sin dato
  private vatByCategory(enterpriseId: string): Observable<Map<number, CategoryVat>> {
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
        const result = new Map<number, CategoryVat>();
        for (const c of categories) {
          const ofCategory = taxes.filter(t => (c.taxes ?? []).includes(t.id));
          const iva = resolveCategoryIva(ofCategory);
          if (iva !== null) result.set(c.id, { ivaPct: iva, taxes: resolveCategoryTaxes(ofCategory) });
        }
        return result;
      })
    );
  }
}
