import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { ProductService } from '../../GeneralMasters/Inventory/Products/Services/product.service';
import { ProductList } from '../../GeneralMasters/Inventory/Products/Models/Product';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { pesosToCents } from '../utils/money';
import { BillingProductCatalog } from './billing-product-catalog';

// IVA por defecto: el producto del inventario no expone un impuesto propio
// (los impuestos cuelgan de la categoría), así que no se inventa uno por producto.
const DEFAULT_IVA_PCT = 19;

// Adapta los productos REALES del inventario (ProductService, el mismo que usa la
// factura de Commercial) al formato de catálogo de Facturación.
@Injectable()
export class InventoryBillingProductCatalog extends BillingProductCatalog {
  private readonly productService = inject(ProductService);
  private readonly localStorageMethods = inject(LocalStorageMethods);

  getProducts(kind: DocumentKind): Observable<BillingProduct[]> {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) return of([]);
    // getActiveProducts ya devuelve solo activos y una página vacía si falla la petición
    return this.productService
      .getActiveProducts(enterpriseId)
      .pipe(map((page) => page.content.map((p) => this.toBillingProduct(p, kind))));
  }

  private toBillingProduct(p: ProductList, kind: DocumentKind): BillingProduct {
    return {
      id: String(p.id),
      code: p.code,
      name: p.name,
      priceCents: this.referencePriceCents(p, kind),
      ivaPct: DEFAULT_IVA_PCT,
    };
  }

  private referencePriceCents(p: ProductList, kind: DocumentKind): number {
    // Compras: el costo del producto es la referencia correcta.
    if (kind === 'PURCHASE') return pesosToCents(p.cost ?? 0);
    // TEMPORAL (ventas): hoy el sistema no tiene precio de venta; la factura legacy de Commercial
    // usa `cost` como precio. Cuando exista un salePrice real, cambiar SOLO esta línea.
    return pesosToCents(p.cost ?? 0);
  }
}
