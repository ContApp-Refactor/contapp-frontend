import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { BillingProduct } from '../models/billing-sale-invoice.model';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';
import { BillingProductCatalog } from './billing-product-catalog';
import { MockBillingSaleInvoiceApi } from './mock-billing-sale-invoice.api';

const INVOICES_KEY = 'billing_sale_invoices';
const SEQ_KEY = 'billing_sale_invoice_seq';
const RETURNS_KEY = 'billing_sale_returns';
const ENT_KEY = 'entData';

describe('MockBillingSaleInvoiceApi (IVA y datos congelados)', () => {
  let api: MockBillingSaleInvoiceApi;
  let products: BillingProduct[];
  let clients: { id: string; name: string; document: string }[];

  beforeEach(() => {
    localStorage.removeItem(RETURNS_KEY);
    localStorage.removeItem(INVOICES_KEY);
    localStorage.removeItem(SEQ_KEY);
    localStorage.setItem(ENT_KEY, JSON.stringify({ id: 'e1', name: 'Empresa Uno', nit: '900', logo: '' }));
    products = [
      { id: 'p1', code: 'P1', name: 'Con IVA', priceCents: 1000, ivaPct: 5 },
      { id: 'p2', code: 'P2', name: 'Sin dato', priceCents: 2000, ivaPct: null },
    ];
    clients = [{ id: 'c1', name: 'Cliente Original', document: '123' }];
    TestBed.configureTestingModule({
      providers: [
        MockBillingSaleInvoiceApi,
        { provide: BillingProductCatalog, useValue: { getProducts: () => of(products) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of(clients) } },
      ],
    });
    api = TestBed.inject(MockBillingSaleInvoiceApi);
  });

  afterEach(() => {
    localStorage.removeItem(RETURNS_KEY);
    localStorage.removeItem(INVOICES_KEY);
    localStorage.removeItem(SEQ_KEY);
    localStorage.removeItem(ENT_KEY);
  });

  const line = (productId: string, over: Record<string, unknown> = {}) => ({
    productId, productName: productId, cantidad: 1, precioUnitarioCents: 1000, ivaPct: null, ...over,
  });

  it('un IVA null sigue al catálogo; sin dato de catálogo usa el respaldo 19 como el back', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({ kind: 'SALE', clientId: 'c1', date: '2026-10-01', lines: [line('p1'), line('p2')] as never }),
    );
    expect(saved.lines[0].ivaPct).toBe(5);
    expect(saved.lines[0].ivaCatalogoPct).toBe(5);
    expect(saved.lines[0].ivaEditado).toBeFalse();
    expect(saved.lines[1].ivaPct).toBe(19);
    expect(saved.lines[1].ivaEditado).toBeFalse();
  });

  it('un IVA editado prevalece sobre el catálogo y queda marcado como editado', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({
        kind: 'SALE', clientId: 'c1', date: '2026-10-01',
        lines: [line('p1', { ivaPct: 0, ivaCatalogoPct: 5, ivaEditado: true })] as never,
      }),
    );
    expect(saved.lines[0].ivaPct).toBe(0);
    expect(saved.lines[0].ivaCatalogoPct).toBe(5);
    expect(saved.lines[0].ivaEditado).toBeTrue();
  });

  it('al leer el borrador una línea sin override sigue al catálogo y la editada no', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({
        kind: 'SALE', clientId: 'c1', date: '2026-10-01',
        lines: [line('p1'), { ...line('p2'), ivaPct: 7, ivaCatalogoPct: 19, ivaEditado: true }] as never,
      }),
    );
    products = [
      { id: 'p1', code: 'P1', name: 'Con IVA', priceCents: 1000, ivaPct: 8 },
      { id: 'p2', code: 'P2', name: 'Sin dato', priceCents: 2000, ivaPct: 8 },
    ];
    const read = await firstValueFrom(api.getById(saved.id));
    expect(read.lines[0].ivaPct).toBe(8); // sigue al catálogo
    expect(read.lines[1].ivaPct).toBe(7); // override del usuario
    expect(read.lines[1].ivaCatalogoPct).toBe(8);
  });

  it('al emitir congela el emisor y el tercero aunque cambien la empresa o el catálogo', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({ kind: 'SALE', clientId: 'c1', date: '2026-10-01', payment: { methodId: '7' }, lines: [line('p1')] as never }),
    );
    expect(saved.issuer ?? null).toBeNull(); // en borrador no hay emisor
    const emitted = await firstValueFrom(api.emit(saved.id, saved.version));
    expect(emitted.issuer?.name).toBe('Empresa Uno');
    expect(emitted.issuer?.nit).toBe('900');

    localStorage.setItem(ENT_KEY, JSON.stringify({ id: 'e1', name: 'Empresa Renombrada', nit: '901', logo: '' }));
    clients = [{ id: 'c1', name: 'Cliente Renombrado', document: '999' }];
    const read = await firstValueFrom(api.getById(saved.id));
    expect(read.issuer?.name).toBe('Empresa Uno');
    expect(read.clientName).toBe('Cliente Original');
    expect(read.clientDocument).toBe('123');
  });

  it('un precio con precioEditado=true IGUAL al catálogo se conserva como override al cambiar el catálogo', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({
        kind: 'SALE', clientId: 'c1', date: '2026-10-01',
        lines: [
          line('p1', { precioCatalogoCents: 1000, precioUnitarioCents: 1000, precioEditado: true }),
          line('p2', { precioCatalogoCents: 2000, precioUnitarioCents: 2000, precioEditado: false }),
        ] as never,
      }),
    );
    expect(saved.lines.map((l) => l.precioEditado)).toEqual([true, false]);
    products = [
      { id: 'p1', code: 'P1', name: 'Con IVA', priceCents: 1300, ivaPct: 5 },
      { id: 'p2', code: 'P2', name: 'Sin dato', priceCents: 2600, ivaPct: null },
    ];
    const read = await firstValueFrom(api.getById(saved.id));
    expect(read.lines[0].precioUnitarioCents).toBe(1000); // override del usuario
    expect(read.lines[1].precioUnitarioCents).toBe(2600); // sigue al catálogo
  });

  it('emit refresca el catálogo antes de congelar (precio de las líneas sin override)', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({
        kind: 'SALE', clientId: 'c1', date: '2026-10-01', payment: { methodId: '7' },
        lines: [line('p1', { precioCatalogoCents: 1000, precioUnitarioCents: 1000, precioEditado: false })] as never,
      }),
    );
    products = [{ id: 'p1', code: 'P1', name: 'Con IVA', priceCents: 1800, ivaPct: 5 }]; // cambió sin que nadie leyera el borrador
    const emitted = await firstValueFrom(api.emit(saved.id, saved.version));
    expect(emitted.lines[0].precioUnitarioCents).toBe(1800);
    expect(emitted.totals?.subtotalCents).toBe(1800);
    expect(emitted.lines[0].subtotalCents).toBe(1800); // subtotal de línea congelado como el back
  });

  it('annul sobre un documento ya ANULADO es idempotente (devuelve el documento, sin verificar la versión)', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({ kind: 'SALE', clientId: 'c1', date: '2026-10-01', payment: { methodId: '7' }, lines: [line('p1')] as never }),
    );
    const emitted = await firstValueFrom(api.emit(saved.id, saved.version));
    const annulled = await firstValueFrom(api.annul(emitted.id, 'error', emitted.version));
    expect(annulled.status).toBe('ANULADA');
    const again = await firstValueFrom(api.annul(emitted.id, 'otra vez', 999)); // versión vieja: igual no falla
    expect(again.status).toBe('ANULADA');
    expect(again.annulReason).toBe('error'); // no se reescribe
    expect(again.version).toBe(annulled.version);
  });

  it('returnStatus se deriva de las devoluciones emitidas (para ocultar "Devolver factura completa" en las ya devueltas)', async () => {
    const saved = await firstValueFrom(
      api.saveDraft({ kind: 'SALE', clientId: 'c1', date: '2026-10-01', payment: { methodId: '7' }, lines: [line('p1', { cantidad: 2 })] as never }),
    );
    expect((await firstValueFrom(api.getById(saved.id))).returnStatus ?? null).toBeNull(); // borrador: sin estado
    const emitted = await firstValueFrom(api.emit(saved.id, saved.version));
    const ret = (status: string, qty: number) => ({
      id: 'r' + qty, number: 'NC-1', status, kind: 'SALE', invoiceId: emitted.id,
      lines: [{ sourceLineNo: 1, productId: 'p1', productName: 'p1', cantidadDevuelta: qty, precioUnitarioCents: 1000, ivaPct: 5 }],
    });
    expect((await firstValueFrom(api.getById(emitted.id))).returnStatus).toBe('SIN_DEVOLUCION');

    localStorage.setItem(RETURNS_KEY, JSON.stringify([ret('EMITIDA', 1), ret('BORRADOR', 5)]));
    expect((await firstValueFrom(api.getById(emitted.id))).returnStatus).toBe('PARCIAL');

    localStorage.setItem(RETURNS_KEY, JSON.stringify([ret('EMITIDA', 2)]));
    const list = await firstValueFrom(api.list());
    expect(list.find((i) => i.id === emitted.id)?.returnStatus).toBe('TOTAL');

    localStorage.setItem(RETURNS_KEY, JSON.stringify([ret('ANULADA', 2)])); // anulada: las cantidades vuelven a estar libres
    expect((await firstValueFrom(api.getById(emitted.id))).returnStatus).toBe('SIN_DEVOLUCION');
  });
});
