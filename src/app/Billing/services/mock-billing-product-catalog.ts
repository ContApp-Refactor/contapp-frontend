import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { DocumentKind } from '../models/document-kind';
import { BillingProductCatalog } from './billing-product-catalog';

// Catálogo con datos quemados, mientras Facturación no se conecta al inventario real.
// Para usar los productos reales: en billing.routes.ts cambiar a InventoryBillingProductCatalog.
@Injectable()
export class MockBillingProductCatalog extends BillingProductCatalog {
  // priceCents = precio de venta; costCents = costo (precio de compra)
  private readonly products: (BillingProduct & { costCents: number })[] = [
    { id: 'p1', code: 'CUA-001', name: 'Cuaderno argollado 100 hojas', priceCents: 850000, costCents: 600000, ivaPct: 19 },
    { id: 'p2', code: 'PAP-001', name: 'Resma de papel carta', priceCents: 1890000, costCents: 1400000, ivaPct: 19 },
    { id: 'p3', code: 'LAP-001', name: 'Caja de lápices x12', priceCents: 1250000, costCents: 900000, ivaPct: 19 },
    { id: 'p4', code: 'MAR-001', name: 'Marcador permanente', priceCents: 320000, costCents: 210000, ivaPct: 19 },
    { id: 'p5', code: 'CAR-001', name: 'Carpeta legajadora', priceCents: 480000, costCents: 320000, ivaPct: 19 },
    { id: 'p6', code: 'BOL-001', name: 'Bolígrafo azul x10', priceCents: 1500000, costCents: 1050000, ivaPct: 19 },
  ];

  getProducts(kind: DocumentKind): Observable<BillingProduct[]> {
    return of(
      this.products.map(({ costCents, ...product }) =>
        kind === 'PURCHASE' ? { ...product, priceCents: costCents } : product,
      ),
    );
  }
}
