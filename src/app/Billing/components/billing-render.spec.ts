import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BillingCounterpartyCatalog } from '../services/billing-counterparty-catalog';
import { BillingProductCatalog } from '../services/billing-product-catalog';
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
    expect(el.textContent).toContain('Ítems');
    expect(el.textContent).not.toContain('Líneas');
  });
  it('menú', async () => {
    setup({}, [inv('i2', 'BORRADOR')], []);
    const el = await render(BillingMenuComponent);
    expect(el.textContent).toContain('Nueva factura de venta');
    expect(el.textContent).toContain('Nueva factura de compra');
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
  it('factura borrador: Emitir factura, título de borrador y categoría del tercero seleccionado', async () => {
    setup({ id: 'i2' }, [inv('i2', 'BORRADOR')], []);
    const el = await render(SaleInvoiceFormComponent);
    expect(el.textContent).toContain('Emitir factura');
    expect(el.querySelector('h1')?.textContent).toContain('Borrador de factura de venta');
    // Cliente seleccionado (c1) con su categoría, no solo el nombre
    expect(el.querySelector('p-dropdown')?.textContent).toContain('Cliente Uno');
    expect(el.querySelector('p-dropdown')?.textContent).toContain('Cliente/Proveedor');
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
