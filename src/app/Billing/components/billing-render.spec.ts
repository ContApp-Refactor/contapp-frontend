import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BillingCounterpartyCatalog } from '../services/billing-counterparty-catalog';
import { BillingProductCatalog } from '../services/billing-product-catalog';
import { BillingPaymentCatalog } from '../services/billing-payment-catalog';
import { BillingTaxCatalog } from '../services/billing-tax-catalog';
import { BillingSaleInvoiceApi } from '../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../services/billing-sale-return.api';
import { BillingMenuComponent } from './billing-menu/billing-menu.component';
import { SaleInvoiceFormComponent } from './sale-invoice-form/sale-invoice-form.component';
import { SaleInvoicePreviewComponent } from './sale-invoice-preview/sale-invoice-preview.component';
import { SaleReturnPreviewComponent } from './sale-return-preview/sale-return-preview.component';
import { SaleInvoiceListComponent } from './sale-invoice-list/sale-invoice-list.component';
import { SaleInvoicePendingComponent } from './sale-invoice-pending/sale-invoice-pending.component';
import { SaleReturnFormComponent } from './sale-return-form/sale-return-form.component';
import { SaleReturnListComponent } from './sale-return-list/sale-return-list.component';
import { BillingTaxBreakdownComponent } from './billing-tax-breakdown/billing-tax-breakdown.component';

const line = (p: string, q: number) => ({
  productId: p, productName: 'Prod ' + p, cantidad: q, precioCatalogoCents: 1000, precioUnitarioCents: 1200,
  ivaCatalogoPct: 19, ivaPct: 19,
});
const inv = (id: string, status: string, kind = 'SALE', extra: Record<string, unknown> = {}) => ({
  id, number: status === 'BORRADOR' ? null : 'FV-1', status, kind, clientId: 'c1', clientName: 'Cliente Uno',
  supplierInvoiceNumber: kind === 'PURCHASE' ? 'X-9' : null, date: '2026-10-01', lines: [line('a', 2), line('b', 1)],
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T11:30:00Z', ...extra,
});
const ret = (id: string, status: string, number: string | null, reason = 'Defecto') => ({
  id, number, status, kind: 'SALE', invoiceId: 'i2', originalNumber: 'FV-1', originalDate: '2026-10-01', clientId: 'c1',
  clientName: 'Cliente Uno', date: '2026-10-03', reason, lines: [{ productId: 'a', productName: 'Prod a', cantidadDevuelta: 1, precioUnitarioCents: 1200, ivaPct: 19 }],
  createdAt: '', updatedAt: '',
});
const avail = [{ lineNo: 1, productId: 'a', productName: 'Prod a', sold: 2, returned: 0, available: 2, precioUnitarioCents: 1200, ivaPct: 19 }];

const defaultClients = [{ id: 'c1', name: 'Cliente Uno', document: '1', category: 'Cliente/Proveedor' }];

const setup = (
  route: { id?: string; kind?: string; invoiceId?: string },
  invoices: unknown[],
  returns: unknown[],
  clients: unknown[] = defaultClients,
) => {
  const params: Record<string, string> = {};
  if (route.id) params['id'] = route.id;
  if (route.invoiceId) params['invoiceId'] = route.invoiceId;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]), provideNoopAnimations(), provideHttpClient(), MessageService,
      { provide: ActivatedRoute, useValue: { snapshot: { data: { kind: route.kind ?? 'SALE' }, paramMap: convertToParamMap(params) } } },
      { provide: BillingSaleInvoiceApi, useValue: {
        list: () => of(invoices), listWithSkipped: () => of({ items: invoices, skipped: 0 }), getById: (id: string) => of(invoices.find((i: any) => i.id === id) ?? invoices[0]),
        saveDraft: () => of(invoices[0]), deleteDraft: () => of(undefined), emit: () => of(invoices[0]), annul: () => of(invoices[0]) } },
      { provide: BillingSaleReturnApi, useValue: {
        listByInvoice: () => of(returns), getAvailability: () => of(avail), getById: () => of(returns[0]),
        listInvoicesWithReturns: () => of([{ invoiceId: 'i2', invoiceNumber: 'FV-1', kind: 'SALE', clientName: 'Cliente Uno', invoiceDate: '2026-10-01', invoiceTotalCents: 5000, returnsCount: 1, returnedTotalCents: 1000, state: 'PARCIAL' }]),
        saveDraft: () => of(returns[0]), emit: () => of(returns[0]), deleteDraft: () => of(undefined), annul: () => of(returns[0]) } },
      { provide: BillingProductCatalog, useValue: { getProducts: () => of([{ id: 'a', code: 'A', name: 'Prod a', priceCents: 1000, ivaPct: 5 }]) } },
      { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of([]) } },
      { provide: BillingTaxCatalog, useValue: { getTaxes: () => of([]) } },
      { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of(clients) } },
    ],
  });
};

const render = async <T>(type: import('@angular/core').Type<T>): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

// Render real (con plantilla) de las pantallas de Facturación: verifica textos y reglas visibles de las notas de mejora
describe('Render de pantallas de Facturación', () => {
  it('lista de facturas', async () => {
    setup({}, [inv('i1', 'EMITIDA'), inv('i2', 'BORRADOR', 'PURCHASE')], []);
    const el = await render(SaleInvoiceListComponent);
    expect(el.textContent).toContain('Cliente Uno');
    expect(el.querySelectorAll('thead tr').length).toBe(1); // los filtros van arriba, fuera de la tabla
    expect(el.textContent).toContain('Ver facturas');
  });
  it('lista de facturas: etiqueta de devolución y sin botón "Devolver factura completa" si ya es TOTAL', async () => {
    setup(
      {},
      [
        inv('i1', 'EMITIDA', 'SALE', { returnStatus: 'TOTAL' }),
        inv('i2', 'EMITIDA', 'SALE', { returnStatus: 'PARCIAL' }),
        inv('i3', 'EMITIDA', 'SALE', { returnStatus: 'SIN_DEVOLUCION' }),
      ],
      [],
    );
    const el = await render(SaleInvoiceListComponent);
    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(3);
    const buttons = (row: Element) => row.querySelectorAll('[title="Devolver factura completa"]').length;
    expect(rows[0].textContent).toContain('Devuelta');
    expect(rows[0].textContent).not.toContain('parcialmente');
    expect(buttons(rows[0])).toBe(0); // TOTAL: nada más que devolver
    expect(rows[1].textContent).toContain('Devuelta parcialmente');
    expect(buttons(rows[1])).toBe(1);
    expect(rows[2].textContent).not.toContain('Devuelta');
    expect(buttons(rows[2])).toBe(1);
  });
  it('lista de facturas: el total de una emitida es el del back', async () => {
    const totals = { subtotalCents: 800000, ivaCents: 187654, totalCents: 987654 };
    setup({}, [inv('i1', 'EMITIDA', 'SALE', { totals })], []);
    const el = await render(SaleInvoiceListComponent);
    expect(el.querySelector('tbody')?.textContent).toMatch(/9\.876,54/);
  });
  it('pendientes (ítems)', async () => {
    setup({}, [inv('i2', 'BORRADOR')], []);
    const el = await render(SaleInvoicePendingComponent);
    expect(el.textContent).toContain('Productos');
    expect(el.textContent).not.toContain('Líneas');
  });
  it('hub de venta: solo opciones de venta, con rutas de venta', async () => {
    setup({}, [inv('i2', 'BORRADOR')], []);
    const el = await render(BillingMenuComponent);
    expect(el.querySelector('h1')?.textContent).toContain('Factura de venta');
    expect(el.textContent).toContain('Nueva venta');
    expect(el.textContent).toContain('Devoluciones');
    expect(el.textContent).not.toContain('Nueva compra');
    const menu = TestBed.createComponent(BillingMenuComponent).componentInstance;
    expect(menu.options.map((o) => o.route)).toEqual(['/billing/sale/new', '/billing/sale/list', '/billing/sale/returns']);
  });
  it('hub de compra: solo opciones de compra, con rutas de compra', async () => {
    setup({ kind: 'PURCHASE' }, [inv('i2', 'BORRADOR')], []);
    const el = await render(BillingMenuComponent);
    expect(el.querySelector('h1')?.textContent).toContain('Factura de compra');
    expect(el.textContent).toContain('Nueva compra');
    expect(el.textContent).not.toContain('Nueva venta');
    const menu = TestBed.createComponent(BillingMenuComponent).componentInstance;
    expect(menu.options.map((o) => o.route)).toEqual(['/billing/purchase/new', '/billing/purchase/list', '/billing/purchase/returns']);
  });
  it('hub: la tabla de pendientes embebida solo muestra borradores de su tipo', async () => {
    setup({ kind: 'PURCHASE' }, [inv('s1', 'BORRADOR', 'SALE', { clientName: 'Cliente Venta' }), inv('p1', 'BORRADOR', 'PURCHASE', { clientName: 'Proveedor Compra' })], []);
    const el = await render(BillingMenuComponent);
    expect(el.textContent).toContain('Proveedor Compra');
    expect(el.textContent).not.toContain('Cliente Venta');
  });
  it('pendientes: solo el tipo de la ruta y sin select de tipo ni columna Tipo', async () => {
    setup({ kind: 'PURCHASE' }, [inv('s1', 'BORRADOR', 'SALE', { clientName: 'Cliente Venta' }), inv('p1', 'BORRADOR', 'PURCHASE', { clientName: 'Proveedor Compra' })], []);
    const el = await render(SaleInvoicePendingComponent);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.textContent).toContain('Proveedor Compra');
    expect(el.textContent).not.toContain('Cliente Venta');
    expect(el.querySelector('p-dropdown')).toBeNull();
    expect(Array.from(el.querySelectorAll('th')).map((t) => t.textContent!.trim())).not.toContain('Tipo');
  });
  it('listado de facturas: solo el tipo de la ruta y sin select de tipo ni columna Tipo', async () => {
    setup({ kind: 'SALE' }, [inv('s1', 'EMITIDA', 'SALE', { clientName: 'Cliente Venta' }), inv('p1', 'EMITIDA', 'PURCHASE', { clientName: 'Proveedor Compra' })], []);
    const el = await render(SaleInvoiceListComponent);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.textContent).toContain('Cliente Venta');
    expect(el.textContent).not.toContain('Proveedor Compra');
    expect(Array.from(el.querySelectorAll('th')).map((t) => t.textContent!.trim())).not.toContain('Tipo');
    expect(el.querySelector('[aria-label="Filtrar por tipo"]')).toBeNull();
    expect(el.querySelectorAll('p-dropdown').length).toBe(2); // estado y estado de devolución
  });
  it('listado de facturas de compra: muestra solo compras', async () => {
    setup({ kind: 'PURCHASE' }, [inv('s1', 'EMITIDA', 'SALE', { clientName: 'Cliente Venta' }), inv('p1', 'EMITIDA', 'PURCHASE', { clientName: 'Proveedor Compra' })], []);
    const el = await render(SaleInvoiceListComponent);
    expect(el.textContent).toContain('Proveedor Compra');
    expect(el.textContent).not.toContain('Cliente Venta');
  });
  it('devoluciones: solo el tipo de la ruta, sin select de tipo ni columna Tipo', async () => {
    setup({ kind: 'PURCHASE' }, [], []);
    const api = TestBed.inject(BillingSaleReturnApi) as any;
    const row = (id: string, kind: string, name: string) => ({ invoiceId: id, invoiceNumber: id, kind, clientName: name, invoiceDate: '2026-10-01', invoiceTotalCents: 5000, returnsCount: 1, returnedTotalCents: 1000, state: 'PARCIAL' });
    api.listInvoicesWithReturns = () => of([row('v1', 'SALE', 'Cliente Venta'), row('c1', 'PURCHASE', 'Proveedor Compra')]);
    const el = await render(SaleReturnListComponent);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.textContent).toContain('Proveedor Compra');
    expect(el.textContent).not.toContain('Cliente Venta');
    expect(el.querySelector('p-dropdown')).toBeNull();
    expect(Array.from(el.querySelectorAll('th')).map((t) => t.textContent!.trim())).not.toContain('Tipo');
  });
  it('facturas con devolución', async () => {
    setup({}, [], []);
    const el = await render(SaleReturnListComponent);
    expect(el.textContent).toContain('Devuelta parcialmente'); // misma etiqueta que el listado y el formulario
    expect(el.textContent).not.toContain('Parcial ');
  });
  it('factura emitida SIN devoluciones: mensaje y sin tabla de devoluciones', async () => {
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA')], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toContain('Esta factura no tiene devoluciones.');
    expect(el.textContent).toContain('Devolver factura completa');
    expect(el.textContent).not.toContain('Emitir factura');
  });
  it('factura emitida CON devoluciones: tabla (sin borradores)', async () => {
    setup(
      { id: 'i2' },
      [inv('i2', 'EMITIDA')],
      [ret('r1', 'EMITIDA', 'NC-1', 'Motivo emitida'), ret('r2', 'BORRADOR', null, 'Motivo del borrador oculto')],
    );
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).not.toContain('Esta factura no tiene devoluciones.');
    expect(el.textContent).toContain('NC-1');
    expect(el.textContent).not.toContain('Continuar');
    // La tabla de devoluciones es la última p-table (antes está la de líneas, que también tiene tbody tr)
    const tables = el.querySelectorAll('p-table');
    const returnRows = tables[tables.length - 1].querySelectorAll('tbody tr');
    expect(returnRows.length).toBe(1); // solo la emitida: el borrador no se lista
    expect(returnRows[0].textContent).toContain('Motivo emitida');
    expect(tables[tables.length - 1].textContent).not.toContain('Motivo del borrador oculto');
    expect(el.textContent).toContain('Devolución 1');
  });
  it('formulario: etiquetas de devolución unificadas ("Devuelta" / "Devuelta parcialmente"), sin "Devuelta totalmente"', async () => {
    const full = {
      ...ret('r1', 'EMITIDA', 'NC-1'),
      lines: [
        { sourceLineNo: 1, productId: 'a', productName: 'Prod a', cantidadDevuelta: 2, precioUnitarioCents: 1200, ivaPct: 19 },
        { sourceLineNo: 2, productId: 'b', productName: 'Prod b', cantidadDevuelta: 1, precioUnitarioCents: 1200, ivaPct: 19 },
      ],
    };
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA')], [full]);
    let el = await render(SaleInvoiceFormComponent);
    const badge = () => Array.from(el.querySelectorAll('span.bg-amber-100')).map((n) => n.textContent?.trim());
    expect(badge()).toEqual(['Devuelta']);
    expect(el.textContent).not.toContain('Devuelta totalmente');
    TestBed.resetTestingModule();
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA')], [ret('r1', 'EMITIDA', 'NC-1')]); // devuelve 1 de 3 unidades
    el = await render(SaleInvoiceFormComponent);
    expect(badge()).toEqual(['Devuelta parcialmente']);
  });
  it('factura borrador: Emitir factura, título de borrador y "NIT - Nombre" del tercero seleccionado (sin categoría)', async () => {
    setup({ id: 'i2' }, [inv('i2', 'BORRADOR')], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toContain('Emitir factura');
    expect(el.querySelector('h1')?.textContent).toContain('Borrador de factura de venta');
    // Cliente seleccionado (c1): "NIT - Nombre", sin la etiqueta de categoría
    expect(el.querySelector('p-dropdown')?.textContent).toContain('1 - Cliente Uno');
    expect(el.querySelector('p-dropdown')?.textContent).not.toContain('Cliente/Proveedor');
  });
  it('factura emitida: título "Factura de venta" y categoría del tercero en solo lectura', async () => {
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA')], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.querySelector('h1')?.textContent).toContain('Factura de venta');
    expect(el.querySelector('h1')?.textContent).not.toContain('Borrador');
    expect(el.textContent).toContain('Cliente Uno — Cliente/Proveedor');
  });
  it('factura emitida: el tercero sale congelado (nombre y documento) aunque el catálogo haya cambiado', async () => {
    const renamed = [{ id: 'c1', name: 'Nombre Renombrado SAS', document: '999', category: 'Cliente' }];
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA', 'SALE', { clientName: 'Cliente Uno', clientDocument: '800123' })], [], renamed);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toContain('Cliente Uno');
    expect(el.textContent).toContain('800123');
    expect(el.textContent).not.toContain('Nombre Renombrado SAS');
    expect(el.textContent).not.toContain('999');
  });
  it('factura en borrador: el tercero sigue al catálogo vivo', async () => {
    const renamed = [{ id: 'c1', name: 'Nombre Renombrado SAS', document: '999', category: 'Cliente' }];
    setup({ id: 'i2' }, [inv('i2', 'BORRADOR', 'SALE', { clientName: 'Cliente Uno' })], [], renamed);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.querySelector('p-dropdown')?.textContent).toContain('Nombre Renombrado SAS');
  });
  it('referencia "cat. X%": en borrador sale de ivaCatalogoPct del back y en emitida no se muestra', async () => {
    const lines = [{ ...line('a', 1), ivaCatalogoPct: 19, ivaPct: 5, ivaEditado: true }];
    setup({ id: 'i2' }, [inv('i2', 'BORRADOR', 'SALE', { lines })], []);
    let el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toContain('cat. 19%'); // no el 5% del catálogo de productos del test
    TestBed.resetTestingModule();
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA', 'SALE', { lines })], []);
    el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).not.toContain('cat.');
  });
  it('IVA sin dato (null): se muestra "—" y no 0%', async () => {
    const lines = [{ ...line('a', 1), ivaCatalogoPct: null, ivaPct: null }];
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA', 'SALE', { lines })], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.querySelector('p-table tbody tr')?.textContent).toContain('—');
    expect(el.querySelector('p-table tbody tr')?.textContent).not.toContain('0%');
  });
  it('documento nuevo: título "Nueva factura de compra"', async () => {
    setup({ kind: 'PURCHASE' }, [inv('i2', 'BORRADOR', 'PURCHASE')], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.querySelector('h1')?.textContent).toContain('Nueva factura de compra');
  });
  it('factura emitida: los totales son los del back, no los recalculados', async () => {
    // Las líneas darían 2*1200+1*1200 = 3600 + 19% = 4284; el back informa otro total
    const totals = { subtotalCents: 800000, ivaCents: 187654, totalCents: 987654 };
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA', 'SALE', { totals })], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toMatch(/9\.876,54/);
    expect(el.textContent).not.toMatch(/42,84/);
  });
  it('factura en borrador: los totales se calculan con las líneas', async () => {
    const totals = { subtotalCents: 800000, ivaCents: 187654, totalCents: 987654 };
    setup({ id: 'i2' }, [inv('i2', 'BORRADOR', 'SALE', { totals })], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toMatch(/42,84/);
    expect(el.textContent).not.toMatch(/9\.876,54/);
  });
  it('devolución borrador: Devolver todo y sin Anular', async () => {
    setup({ id: 'r1' }, [inv('i2', 'EMITIDA')], [ret('r1', 'BORRADOR', null)]);
    const el = await render(SaleReturnFormComponent);
    expect(el.textContent).toContain('Devolver todo');
    expect(el.textContent).not.toContain('Anular');
  });
  it('devolución emitida: sin Anular', async () => {
    setup({ id: 'r1' }, [inv('i2', 'EMITIDA')], [ret('r1', 'EMITIDA', 'NC-1')]);
    const el = await render(SaleReturnFormComponent);
    expect(el.textContent).not.toContain('Anular');
    expect(el.textContent).not.toContain('Devolver todo');
    expect(el.textContent).not.toContain('Emitir devolución');
  });
  it('devolución borrador: botón "Emitir devolución"', async () => {
    setup({ id: 'r1' }, [inv('i2', 'EMITIDA')], [ret('r1', 'BORRADOR', null)]);
    const el = await render(SaleReturnFormComponent);
    expect(el.textContent).toContain('Emitir devolución');
  });
  it('devolución emitida sin "Vendido" del back: muestra "—" en vez de 0', async () => {
    setup({ id: 'r1' }, [inv('i2', 'EMITIDA')], [ret('r1', 'EMITIDA', 'NC-1')]);
    const el = await render(SaleReturnFormComponent);
    const cells = el.querySelectorAll('p-table tbody tr:first-child td');
    expect(cells[2].textContent?.trim()).toBe('—'); // #, Producto, Vendido
  });
});

// Vistas previas: el emisor de un documento emitido es el congelado por el back; localStorage solo es respaldo
describe('Vistas previas: emisor congelado', () => {
  const ENT_KEY = 'entData';
  const issuer = { enterpriseId: 'e1', name: 'Emisor Congelado SAS', nit: '900123', dv: '7', active: true };

  beforeEach(() => {
    localStorage.setItem(ENT_KEY, JSON.stringify({ id: 'e9', name: 'Empresa Viva (localStorage)', nit: '111', logo: '' }));
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
  });
  afterEach(() => localStorage.removeItem(ENT_KEY));

  const invoicePreview = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(SaleInvoicePreviewComponent);
    fixture.componentRef.setInput('status', inputs['status']);
    fixture.componentRef.setInput('date', '2026-10-01');
    fixture.componentRef.setInput('lines', []);
    if ('issuer' in inputs) fixture.componentRef.setInput('issuer', inputs['issuer']);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('factura emitida: muestra el emisor de la respuesta (con DV) y no el de localStorage', () => {
    const text = invoicePreview({ status: 'EMITIDA', issuer });
    expect(text).toContain('Emisor Congelado SAS');
    expect(text).toContain('NIT: 900123-7');
    expect(text).not.toContain('Empresa Viva');
    expect(text).not.toContain('111');
  });
  it('factura en borrador (sin emisor): usa localStorage como respaldo', () => {
    const text = invoicePreview({ status: 'BORRADOR', issuer: null });
    expect(text).toContain('Empresa Viva (localStorage)');
    expect(text).toContain('NIT: 111');
  });

  const returnPreview = (status: string, withIssuer: boolean) => {
    const fixture = TestBed.createComponent(SaleReturnPreviewComponent);
    fixture.componentRef.setInput('saleReturn', {
      ...ret('r1', status, status === 'BORRADOR' ? null : 'NC-1'),
      clientDocument: '800123',
      issuer: withIssuer ? issuer : null,
    });
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('devolución emitida: emisor congelado y documento del tercero de la respuesta', () => {
    const text = returnPreview('EMITIDA', true);
    expect(text).toContain('Emisor Congelado SAS');
    expect(text).toContain('NIT: 900123-7');
    expect(text).toContain('800123');
    expect(text).not.toContain('Empresa Viva');
  });
  it('devolución en borrador (sin emisor): usa localStorage como respaldo', () => {
    const text = returnPreview('BORRADOR', false);
    expect(text).toContain('Empresa Viva (localStorage)');
  });
});

// Desglose de impuestos por línea: "Nombre: n%" uno debajo del otro; sin desglose, valor único como siempre.
// El cálculo NO cambia: el impuesto de la línea usa ivaPct (la suma de las tarifas).
describe('Desglose de impuestos por línea', () => {
  const IVA = { name: 'Iva', rate: 19 };
  const ICA = { name: 'Ica', rate: 6 };
  const SALD = { name: 'SalD', rate: 8 };
  const items = (root: Element | null | undefined) =>
    Array.from(root?.querySelectorAll('[data-testid="tax-item"]') ?? []).map((n) => n.textContent?.trim());
  // Celdas: #, Producto, Cant., Ref., Precio unitario, Impuesto %, Subtotal
  const taxCell = (el: HTMLElement, row = 0) =>
    el.querySelectorAll('p-table tbody tr')[row]?.querySelectorAll('td')[5] as HTMLElement | undefined;

  describe('componente', () => {
    beforeEach(() => TestBed.configureTestingModule({}));
    const breakdown = (taxes: unknown, rate: number | null) => {
      const fixture = TestBed.createComponent(BillingTaxBreakdownComponent);
      fixture.componentRef.setInput('taxes', taxes);
      fixture.componentRef.setInput('rate', rate);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('1, 2 y 3 impuestos: un "Nombre: n%" por renglón, sin partir cada etiqueta', () => {
      expect(items(breakdown([IVA], 19))).toEqual(['Iva: 19%']);
      expect(items(breakdown([IVA, ICA], 25))).toEqual(['Iva: 19%', 'Ica: 6%']);
      const three = breakdown([ICA, SALD, { name: 'Iva', rate: 12 }], 26);
      expect(items(three)).toEqual(['Ica: 6%', 'SalD: 8%', 'Iva: 12%']);
      expect(three.querySelectorAll('li.whitespace-nowrap').length).toBe(3);
      expect(three.textContent).not.toContain('26%'); // no se muestra la suma
    });
    it('documento viejo / sin desglose: el valor único como hoy ("19%"), y "—" sin dato', () => {
      expect(breakdown(undefined, 19).querySelector('[data-testid="tax-single"]')?.textContent?.trim()).toBe('19%');
      expect(breakdown([], 26).textContent?.trim()).toBe('26%');
      expect(breakdown(null, null).textContent?.trim()).toBe('—');
      expect(breakdown([{ name: 'Iva', rate: 12.5 }], 12.5).textContent?.trim()).toBe('Iva: 12.5%');
    });
  });

  describe('pantallas', () => {
    it('factura borrador: con impuestos de categoría el desglose es de solo lectura; sin ellos queda la casilla editable', async () => {
      const lines = [
        { ...line('a', 1), ivaCatalogoPct: 25, ivaPct: 25, taxes: [IVA, ICA] },
        { ...line('b', 1), ivaCatalogoPct: 19, ivaPct: 19, taxes: [] },
      ];
      setup({ id: 'i2' }, [inv('i2', 'BORRADOR', 'SALE', { lines })], []);
      const el = await render(SaleInvoiceFormComponent);
      expect(items(taxCell(el, 0))).toEqual(['Iva: 19%', 'Ica: 6%']);
      expect(taxCell(el, 0)?.querySelector('p-inputnumber')).toBeNull();
      expect(taxCell(el, 1)?.querySelector('p-inputnumber')).not.toBeNull();
      expect(el.querySelector('thead')?.textContent).toContain('Impuesto %');
    });
    it('factura borrador: totales sin cambio (el impuesto usa la suma)', async () => {
      // 2 x 1200 = 2400 + 25% = 600 => 30,00 ; 1 x 1200 = 1200 + 19% = 228 => 14,28 ; total 44,28
      const lines = [
        { ...line('a', 2), ivaCatalogoPct: 25, ivaPct: 25, taxes: [IVA, ICA] },
        { ...line('b', 1) },
      ];
      setup({ id: 'i2' }, [inv('i2', 'BORRADOR', 'SALE', { lines })], []);
      const el = await render(SaleInvoiceFormComponent);
      expect(el.textContent).toMatch(/44,28/);
    });
    it('factura emitida: muestra el desglose congelado; un documento viejo sin taxes muestra el % único', async () => {
      const lines = [
        { ...line('a', 1), ivaPct: 26, taxes: [ICA, SALD, { name: 'Iva', rate: 12 }] },
        { ...line('b', 1) }, // documento viejo: sin `taxes`
      ];
      setup({ id: 'i2' }, [inv('i2', 'EMITIDA', 'SALE', { lines })], []);
      const el = await render(SaleInvoiceFormComponent);
      expect(items(taxCell(el, 0))).toEqual(['Ica: 6%', 'SalD: 8%', 'Iva: 12%']);
      expect(taxCell(el, 1)?.textContent?.trim()).toBe('19%');
      expect(el.querySelector('p-table p-inputnumber')).toBeNull();
    });
    it('línea agregada desde el catálogo con impuestos de categoría: desglose de solo lectura (vista previa)', async () => {
      setup({ kind: 'SALE' }, [inv('i2', 'BORRADOR')], []);
      TestBed.overrideProvider(BillingProductCatalog, {
        useValue: { getProducts: () => of([{ id: 'a', code: 'A', name: 'Prod a', priceCents: 1000, ivaPct: 25, taxes: [IVA, ICA] }]) },
      });
      const fixture = TestBed.createComponent(SaleInvoiceFormComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const cmp = fixture.componentInstance as unknown as { selectedProductId: string | null; addProduct: () => void };
      cmp.selectedProductId = 'a';
      cmp.addProduct();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(items(taxCell(el, 0))).toEqual(['Iva: 19%', 'Ica: 6%']);
      expect(taxCell(el, 0)?.querySelector('p-inputnumber')).toBeNull();
    });
    it('vista previa de factura: desglose por línea', () => {
      TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
      const fixture = TestBed.createComponent(SaleInvoicePreviewComponent);
      fixture.componentRef.setInput('status', 'BORRADOR');
      fixture.componentRef.setInput('date', '2026-10-01');
      fixture.componentRef.setInput('lines', [{ ...line('a', 1), ivaPct: 25, taxes: [IVA, ICA] }, line('b', 1)]);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(items(el)).toEqual(['Iva: 19%', 'Ica: 6%']);
      expect(el.querySelectorAll('tbody tr')[1].textContent).toContain('19%');
    });
    it('vista previa de devolución: desglose heredado', () => {
      TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
      const fixture = TestBed.createComponent(SaleReturnPreviewComponent);
      const r = ret('r1', 'EMITIDA', 'NC-1');
      fixture.componentRef.setInput('saleReturn', { ...r, lines: [{ ...r.lines[0], ivaPct: 25, taxes: [IVA, ICA] }] });
      fixture.detectChanges();
      expect(items(fixture.nativeElement as HTMLElement)).toEqual(['Iva: 19%', 'Ica: 6%']);
    });
    it('devolución emitida: muestra el desglose heredado de la línea original (solo lectura)', async () => {
      const r = ret('r1', 'EMITIDA', 'NC-1');
      setup({ id: 'r1' }, [inv('i2', 'EMITIDA')], [{ ...r, lines: [{ ...r.lines[0], sourceLineNo: 1, ivaPct: 25, taxes: [IVA, ICA] }] }]);
      const el = await render(SaleReturnFormComponent);
      expect(items(el.querySelector('p-table tbody'))).toEqual(['Iva: 19%', 'Ica: 6%']);
    });
    it('devolución borrador: el desglose sale de la disponibilidad (línea original); sin él, el % único', async () => {
      setup({ id: 'r1' }, [inv('i2', 'EMITIDA')], [ret('r1', 'BORRADOR', null)]);
      TestBed.overrideProvider(BillingSaleReturnApi, {
        useValue: {
          listByInvoice: () => of([]),
          getById: () => of(ret('r1', 'BORRADOR', null)),
          getAvailability: () =>
            of([
              { ...avail[0], ivaPct: 25, taxes: [IVA, ICA] },
              { ...avail[0], lineNo: 2, productId: 'b', productName: 'Prod b' },
            ]),
          saveDraft: () => of(ret('r1', 'BORRADOR', null)),
        },
      });
      const el = await render(SaleReturnFormComponent);
      const rows = el.querySelectorAll('p-table tbody tr');
      expect(items(rows[0])).toEqual(['Iva: 19%', 'Ica: 6%']);
      expect(rows[1].textContent).toContain('19%');
      expect(items(rows[1])).toEqual([]);
    });
  });
});

// Patrón de encabezado unificado: título a la izquierda y acciones (Volver, etc.) arriba a la derecha, apilado en móvil
describe('Encabezado unificado de Facturación', () => {
  const cabecera = (el: HTMLElement) => {
    const header = el.querySelector('h1')!.closest('div.flex-col')!;
    return { header, acciones: header.querySelector(':scope > div[class~="sm:justify-end"]') as HTMLElement | null };
  };
  const vistas: [string, () => void, import('@angular/core').Type<unknown>][] = [
    ['hub', () => setup({}, [inv('i2', 'BORRADOR')], []), BillingMenuComponent],
    ['pendientes', () => setup({}, [inv('i2', 'BORRADOR')], []), SaleInvoicePendingComponent],
    ['lista de facturas', () => setup({}, [inv('i1', 'EMITIDA')], []), SaleInvoiceListComponent],
    ['facturas con devolución', () => setup({}, [inv('i1', 'EMITIDA')], []), SaleReturnListComponent],
    ['formulario de factura', () => setup({ id: 'i2' }, [inv('i2', 'EMITIDA')], []), SaleInvoiceFormComponent],
  ];
  for (const [nombre, preparar, tipo] of vistas) {
    it(`${nombre}: acciones agrupadas arriba a la derecha y apiladas en pantallas pequeñas`, async () => {
      preparar();
      const el = await render(tipo);
      const { header, acciones } = cabecera(el);
      expect(header.className).toContain('lg:flex-row');
      expect(acciones).not.toBeNull();
      expect(acciones!.querySelector('p-button')).not.toBeNull();
    });
  }
});

// Retenciones en las vistas: vista previa del borrador, factura emitida e impresión (la hoja #sheet que va al PDF)
describe('Retenciones en la vista previa e impresión', () => {
  const whs = [
    { code: 'RETE_ICA' as const, label: 'ReteICA', taxName: 'ICA', ratePct: 20, amountCents: 400000 },
    { code: 'RETE_FUENTE' as const, label: 'ReteFuente', taxName: 'Fuente', ratePct: 10, amountCents: 200000 },
  ];
  const big = { ...line('a', 1), precioUnitarioCents: 2000000, ivaPct: 15, ivaCatalogoPct: 15 };
  const preview = (status: string, extra: Record<string, unknown> = {}) => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(SaleInvoicePreviewComponent);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('date', '2026-10-01');
    fixture.componentRef.setInput('lines', [big]);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const rowsOf = (root: Element) =>
    Array.from(root.querySelectorAll('[data-testid="withholding-row"]')).map((r) => r.textContent?.replace(/\s+/g, ' ').trim());

  it('borrador: líneas de retención con signo menos y TOTAL neto 17.000', () => {
    const el = preview('BORRADOR', { withholdings: whs });
    expect(rowsOf(el).length).toBe(2);
    expect(rowsOf(el)[0]).toContain('ReteICA');
    expect(rowsOf(el)[0]).toMatch(/-\s?\$?\s?4\.000/);
    expect(el.querySelector('[data-testid="summary-total"]')?.textContent).toMatch(/17\.000/);
  });
  it('emitida: usa el total neto del back y las retenciones del snapshot', () => {
    const totals = { subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 600000, totalCents: 1700000 };
    const el = preview('EMITIDA', { number: 'FV-1', totals, withholdings: whs });
    expect(rowsOf(el).length).toBe(2);
    expect(el.querySelector('[data-testid="summary-total"]')?.textContent).toMatch(/17\.000/);
  });
  it('impresión: las retenciones están dentro de la hoja #sheet y el botón Imprimir queda fuera', () => {
    const el = preview('EMITIDA', { number: 'FV-1', withholdings: whs });
    const sheet = el.querySelector('div.relative.mx-auto')!; // la hoja que se convierte a PDF
    expect(sheet.querySelectorAll('[data-testid="withholding-row"]').length).toBe(2);
    expect(sheet.textContent).not.toContain('Imprimir');
    expect(el.textContent).toContain('Imprimir');
  });
  it('sin retenciones no se muestra ninguna línea y el total es el de siempre', () => {
    const el = preview('BORRADOR');
    expect(rowsOf(el).length).toBe(0);
    expect(el.querySelector('[data-testid="summary-total"]')?.textContent).toMatch(/23\.000/);
  });
  it('formulario de factura emitida con retenciones: filas y total neto del back', async () => {
    const totals = { subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 600000, totalCents: 1700000 };
    const withholdings = whs.map((w) => ({ code: w.code, taxId: '1', taxName: w.taxName, ratePct: w.ratePct, amountCents: w.amountCents }));
    setup({ id: 'i2' }, [inv('i2', 'EMITIDA', 'SALE', { lines: [big], totals, withholdings })], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(rowsOf(el).length).toBe(2);
    expect(el.querySelector('[data-testid="summary-total"]')?.textContent).toMatch(/17\.000/);
    expect(el.querySelector('[data-testid="withholdings"]')).toBeNull();
  });
  it('lista de facturas: el total de una emitida con retenciones es el neto del back', async () => {
    const totals = { subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 600000, totalCents: 1700000 };
    setup({}, [inv('i1', 'EMITIDA', 'SALE', { totals })], []);
    const el = await render(SaleInvoiceListComponent);
    expect(el.querySelector('tbody')?.textContent).toMatch(/17\.000/);
  });
  it('devolución: no muestra retenciones (siempre 0)', () => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(SaleReturnPreviewComponent);
    fixture.componentRef.setInput('saleReturn', { ...ret('r1', 'EMITIDA', 'NC-1'), totals: { subtotalCents: 1200, ivaCents: 228, withholdingsCents: 0, totalCents: 1428 } });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="withholding-row"]')).toBeNull();
    expect(el.textContent).toMatch(/14,28/);
  });
});
