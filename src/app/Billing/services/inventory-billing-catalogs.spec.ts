import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { MockBillingCounterpartyCatalog } from './mock-billing-counterparty-catalog';
import { InventoryBillingCounterpartyCatalog } from './inventory-billing-counterparty-catalog.service';
import { InventoryBillingProductCatalog, resolveCategoryIva } from './inventory-billing-product-catalog.service';

const configure = (service: unknown) =>
  TestBed.configureTestingModule({
    providers: [
      service as never,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LocalStorageMethods, useValue: { getIdEnterprise: () => 'ent-1' } },
    ],
  });

describe('InventoryBillingCounterpartyCatalog', () => {
  let catalog: InventoryBillingCounterpartyCatalog;
  let httpMock: HttpTestingController;

  const thirds = {
    content: [
      { thId: 1, names: 'Ana', lastNames: 'Pérez', idNumber: 10, state: true, thirdTypes: [{ thirdTypeName: 'Cliente' }] },
      { thId: 2, socialReason: 'Proveedora S.A.', idNumber: 20, state: true, thirdTypes: [{ thirdTypeName: 'Proveedor' }] },
      { thId: 3, names: 'Luis', lastNames: 'Gómez', idNumber: 30, state: true, thirdTypes: [{ thirdTypeName: 'Cliente' }, { thirdTypeName: 'Proveedor' }] },
      { thId: 4, names: 'Sin', lastNames: 'Tipo', idNumber: 40, state: true, thirdTypes: [] },
      { thId: 5, names: 'Inactivo', lastNames: 'X', idNumber: 50, state: false, thirdTypes: [{ thirdTypeName: 'Cliente' }] },
    ],
  };

  beforeEach(() => {
    configure(InventoryBillingCounterpartyCatalog);
    catalog = TestBed.inject(InventoryBillingCounterpartyCatalog);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  (['SALE', 'PURCHASE'] as const).forEach((kind) => {
    it(`${kind}: lista TODOS los terceros activos, con su categoría`, () => {
      let result: { id: string; name: string; category?: string }[] = [];
      catalog.getCounterparties(kind).subscribe((r) => (result = r));
      httpMock.expectOne((r) => r.url === '/api/thirds/').flush(thirds);
      expect(result.map((r) => r.id)).toEqual(['1', '2', '3', '4']); // sin el inactivo ni filtro por tipo
      expect(result.map((r) => r.category)).toEqual(['Cliente', 'Proveedor', 'Cliente/Proveedor', '']);
      expect(result[0].name).toBe('Ana Pérez');
      expect(result[1].name).toBe('Proveedora S.A.');
    });
  });
});

describe('MockBillingCounterpartyCatalog', () => {
  it('venta y compra ven todos los terceros (clientes y proveedores) con categoría', (done) => {
    const mock = new MockBillingCounterpartyCatalog();
    mock.getCounterparties('SALE').subscribe((sale) => {
      mock.getCounterparties('PURCHASE').subscribe((purchase) => {
        expect(sale.length).toBe(purchase.length);
        expect(sale.some((c) => c.category === 'Proveedor')).toBeTrue();
        expect(sale.some((c) => c.category === 'Cliente')).toBeTrue();
        expect(sale.map((c) => c.id).sort()).toEqual(purchase.map((c) => c.id).sort());
        done();
      });
    });
  });
});

describe('InventoryBillingProductCatalog (IVA desde la categoría)', () => {
  let catalog: InventoryBillingProductCatalog;
  let httpMock: HttpTestingController;

  const products = {
    content: [
      { id: 1, code: 'P1', name: 'Con IVA', cost: 100, categoryId: 10 },
      { id: 2, code: 'P2', name: 'Sin IVA identificable', cost: 50, categoryId: 11 },
      { id: 3, code: 'P3', name: 'Sin categoría', cost: 20, categoryId: null },
    ],
  };
  const categories = { content: [{ id: 10, taxes: [7, 8] }, { id: 11, taxes: [8] }] };
  const taxes = [
    { id: 7, code: 'IVA19', description: 'IVA general', interest: 19 },
    { id: 8, code: 'RTF', description: 'Retención en la fuente', interest: 3.5 },
  ];

  beforeEach(() => {
    configure(InventoryBillingProductCatalog);
    catalog = TestBed.inject(InventoryBillingProductCatalog);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('suma los impuestos de la categoría como vista previa; sin categoría queda sin dato (null)', () => {
    let result: { id: string; priceCents: number; ivaPct: number | null }[] = [];
    catalog.getProducts('SALE').subscribe((r) => (result = r));
    httpMock.expectOne((r) => r.url === '/api/products/findActivate').flush(products);
    httpMock.expectOne((r) => r.url === '/api/categories/findActivate').flush(categories);
    httpMock.expectOne('/api/tax/active/ent-1').flush(taxes);
    expect(result.map((p) => p.ivaPct)).toEqual([22.5, 3.5, null]);
    expect(result.map((p) => p.priceCents)).toEqual([10000, 5000, 2000]);
  });

  it('si falla categorías o impuestos el catálogo sigue, con el IVA sin dato (null) y no 0', () => {
    let result: { ivaPct: number | null }[] = [];
    catalog.getProducts('PURCHASE').subscribe((r) => (result = r));
    httpMock.expectOne((r) => r.url === '/api/products/findActivate').flush(products);
    httpMock.expectOne((r) => r.url === '/api/categories/findActivate').flush('x', { status: 403, statusText: 'Forbidden' });
    httpMock.expectOne('/api/tax/active/ent-1').flush('x', { status: 500, statusText: 'Error' });
    expect(result.length).toBe(3);
    expect(result.every((p) => p.ivaPct === null)).toBeTrue();
  });

  it('si falla solo uno de los dos (impuestos) tampoco inventa 0', () => {
    let result: { ivaPct: number | null }[] = [];
    catalog.getProducts('SALE').subscribe((r) => (result = r));
    httpMock.expectOne((r) => r.url === '/api/products/findActivate').flush(products);
    httpMock.expectOne((r) => r.url === '/api/categories/findActivate').flush(categories);
    httpMock.expectOne('/api/tax/active/ent-1').flush('x', { status: 500, statusText: 'Error' });
    expect(result.every((p) => p.ivaPct === null)).toBeTrue();
  });
});

describe('resolveCategoryIva (suma de todos los impuestos de la categoría, igual que el back)', () => {
  const tax = (id: number, code: string, description: string, interest: number) => ({ id, code, description, interest });

  it('un solo impuesto: su tarifa, sin importar el nombre', () => {
    expect(resolveCategoryIva([tax(1, 'Ica', 'impuesto Salud', 6)])).toBe(6);
    expect(resolveCategoryIva([tax(1, 'RETEIVA', '', 15)])).toBe(15);
  });
  it('varios impuestos: se suman (Ica 6 + SalD 8 + Iva 12 = 26)', () => {
    expect(resolveCategoryIva([tax(1, 'Ica', 'impuesto Salud', 6), tax(2, 'SalD', 'impuesto Salud', 8), tax(3, 'Iva', 'Impuesto del gobierno', 12)])).toBe(26);
  });
  it('IVA + retención o + consumo también se suman', () => {
    expect(resolveCategoryIva([tax(1, 'IVA5', '', 5), tax(2, 'RETEIVA', 'ReteIVA 15%', 15)])).toBe(20);
    expect(resolveCategoryIva([tax(1, 'IVA5', '', 5), tax(2, 'ICO', 'Impuesto al consumo', 8)])).toBe(13);
  });
  it('redondea a 2 decimales', () => {
    expect(resolveCategoryIva([tax(1, 'A', '', 0.1), tax(2, 'B', '', 0.2)])).toBe(0.3);
  });
  it('sin impuestos o con suma fuera de 0..100 => null (el back usa su valor por defecto)', () => {
    expect(resolveCategoryIva([])).toBeNull();
    expect(resolveCategoryIva([tax(1, 'A', '', 60), tax(2, 'B', '', 50)])).toBeNull();
  });
});

describe('InventoryBillingProductCatalog (resolución de IVA con retenciones y varios IVA)', () => {
  it('aplica la regla del back por categoría', () => {
    configure(InventoryBillingProductCatalog);
    const catalog = TestBed.inject(InventoryBillingProductCatalog);
    const httpMock = TestBed.inject(HttpTestingController);
    let result: { ivaPct: number | null }[] = [];
    catalog.getProducts('SALE').subscribe((r) => (result = r));
    httpMock.expectOne((r) => r.url === '/api/products/findActivate').flush({
      content: [
        { id: 1, code: 'A', name: 'A', cost: 1, categoryId: 1 },
        { id: 2, code: 'B', name: 'B', cost: 1, categoryId: 2 },
        { id: 3, code: 'C', name: 'C', cost: 1, categoryId: 3 },
      ],
    });
    httpMock.expectOne((r) => r.url === '/api/categories/findActivate').flush({
      content: [
        { id: 1, taxes: [1, 2] }, // IVA5 + ReteIVA15 => 20
        { id: 2, taxes: [1, 3, 4] }, // IVA5 + IVA19 + ICA => 25
        { id: 3, taxes: [3, 5] }, // IVA19 + IVA0 => 19
      ],
    });
    httpMock.expectOne('/api/tax/active/ent-1').flush([
      { id: 1, code: 'IVA5', description: 'IVA 5%', interest: 5 },
      { id: 2, code: 'RETEIVA', description: 'ReteIVA 15%', interest: 15 },
      { id: 3, code: 'IVA19', description: 'IVA 19%', interest: 19 },
      { id: 4, code: 'ICA', description: 'Industria y comercio', interest: 1 },
      { id: 5, code: 'IVA0', description: 'IVA excluido', interest: 0 },
    ]);
    expect(result.map((p) => p.ivaPct)).toEqual([20, 25, 19]);
    httpMock.verify();
  });
});
