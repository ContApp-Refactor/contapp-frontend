import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingPaymentCatalog } from '../../services/billing-payment-catalog';
import { BillingTax, BillingTaxCatalog } from '../../services/billing-tax-catalog';
import { BillingProductCatalog } from '../../services/billing-product-catalog';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { SaleInvoiceFormComponent } from './sale-invoice-form.component';

const line = {
  lineNo: 1, productId: 'a', productName: 'Prod a', cantidad: 2, precioCatalogoCents: 1000, precioUnitarioCents: 1000,
  precioEditado: false, ivaCatalogoPct: 19, ivaPct: 19, ivaEditado: false,
};
const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'i1', number: null, status: 'BORRADOR', kind: 'SALE', clientId: 'c1', clientName: 'Cliente Uno', date: '2026-11-09',
  createdAt: '', updatedAt: '', version: 1, lines: [line], ...over,
});

describe('Formulario de factura: retenciones', () => {
  let fixture: ComponentFixture<SaleInvoiceFormComponent>;
  let component: SaleInvoiceFormComponent;
  let saveDraft: jasmine.Spy;

  const defaultTaxes: BillingTax[] = [{ id: '1', name: 'IVA', rate: 19 }, { id: '2', name: 'ICA', rate: 0.966 }];
  const setup = async (kind: 'SALE' | 'PURCHASE', doc: Record<string, unknown> = {}, taxes: BillingTax[] = defaultTaxes) => {
    saveDraft = jasmine.createSpy('saveDraft').and.callFake(() => of(invoice({ ...doc, version: 2 })));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideNoopAnimations(), provideHttpClient(), MessageService,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { kind }, paramMap: convertToParamMap({ id: 'i1' }) } } },
        {
          provide: BillingSaleInvoiceApi,
          useValue: {
            getById: () => of(structuredClone(invoice({ kind, ...doc }))), saveDraft, deleteDraft: () => of(undefined),
            emit: () => of(invoice({ ...doc, status: 'EMITIDA' })), annul: () => of(invoice()),
          },
        },
        { provide: BillingSaleReturnApi, useValue: { listByInvoice: () => of([]), getAvailability: () => of([]) } },
        { provide: BillingProductCatalog, useValue: { getProducts: () => of([]) } },
        { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of([{ id: '7', name: 'Efectivo' }]) } },
        { provide: BillingTaxCatalog, useValue: { getTaxes: () => of(taxes) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([{ id: 'c1', name: 'Cliente Uno', document: '1' }]) } },
      ],
    });
    fixture = TestBed.createComponent(SaleInvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement;
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`);
  const boxes = () => Array.from(el().querySelectorAll('[data-testid="withholdings"] p-checkbox'));
  const click = (code: string) => {
    (el().querySelector(`[data-testid="withholding-${code}"] input`) as HTMLInputElement).click();
    fixture.detectChanges();
  };

  it('venta: 4 casillas con AutoRenta, con grupo accesible', async () => {
    await setup('SALE');
    expect(boxes().length).toBe(4);
    expect(el().querySelector('label[for="withholding-AUTO_RENTA"]')?.textContent).toContain('AutoRenta');
    expect(q('withholdings')?.getAttribute('role')).toBe('group');
    expect(q('withholdings')?.getAttribute('aria-label')).toBe('Retenciones');
    expect(el().querySelector('label[for="withholding-RETE_IVA"]')?.textContent).toContain('ReteIVA');
  });

  it('compra: 3 casillas, sin AutoRenta', async () => {
    await setup('PURCHASE', { supplierInvoiceNumber: 'F-1' });
    expect(boxes().length).toBe(3);
    expect(q('withholding-AUTO_RENTA')).toBeNull();
  });

  it('marca ninguna, una o varias y el signal refleja la selección', async () => {
    await setup('SALE');
    expect(component.withholdings()).toEqual([]);
    click('RETE_ICA');
    expect(component.withholdings()).toEqual(['RETE_ICA']);
    click('AUTO_RENTA');
    expect(component.withholdings()).toEqual(['RETE_ICA', 'AUTO_RENTA']);
    click('RETE_ICA');
    expect(component.withholdings()).toEqual(['AUTO_RENTA']);
  });

  // Convertido: antes marcar casillas nunca guardaba (solo UI). Ahora guarda cuando hay impuesto elegido
  it('marcar una casilla SIN impuesto no guarda el borrador (no hay nada que enviar)', async () => {
    await setup('SALE');
    component.toggleWithholding('RETE_IVA', true);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 1500));
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('elegir el impuesto guarda el borrador con la retención', async () => {
    await setup('SALE');
    component.toggleWithholding('RETE_ICA', true);
    component.onWithholdingTaxChange('RETE_ICA', '2');
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 1500));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft.calls.mostRecent().args[0].withholdings).toEqual([{ code: 'RETE_ICA', taxId: '2' }]);
  });

  it('el payload solo incluye las marcadas con impuesto; desmarcar guarda la lista vacía', async () => {
    await setup('SALE');
    component.toggleWithholding('RETE_IVA', true); // sin impuesto: no se envía
    component.toggleWithholding('RETE_FUENTE', true);
    component.onWithholdingTaxChange('RETE_FUENTE', '1');
    expect(component.withholdingPayload()).toEqual([{ code: 'RETE_FUENTE', taxId: '1' }]);
    await new Promise((r) => setTimeout(r, 1500));
    expect(saveDraft.calls.mostRecent().args[0].withholdings).toEqual([{ code: 'RETE_FUENTE', taxId: '1' }]);
    component.toggleWithholding('RETE_FUENTE', false);
    await new Promise((r) => setTimeout(r, 1500));
    expect(saveDraft.calls.mostRecent().args[0].withholdings).toEqual([]);
  });

  it('no aparece en emitida ni anulada', async () => {
    await setup('SALE', { status: 'EMITIDA', number: 'FV-1' });
    expect(q('withholdings')).toBeNull();
    TestBed.resetTestingModule();
    await setup('SALE', { status: 'ANULADA', number: 'FV-1' });
    expect(q('withholdings')).toBeNull();
  });

  const taxSelect = (code: string) => q(`withholding-tax-${code}`);
  const taxSelects = () => el().querySelectorAll('[data-testid^="withholding-tax-"]');

  it('sin marcar no hay selects de impuesto', async () => {
    await setup('SALE');
    expect(taxSelects().length).toBe(0);
  });

  it('al marcar aparece su select, accesible, con los impuestos del catálogo', async () => {
    await setup('SALE');
    click('RETE_IVA');
    expect(taxSelect('RETE_IVA')).not.toBeNull();
    expect(taxSelect('RETE_ICA')).toBeNull();
    expect(el().querySelector('label[for="withholding-tax-RETE_IVA"]')?.textContent).toContain('Impuesto para ReteIVA');
    expect(component.taxOptions().map((o) => o.label)).toEqual(['IVA - 19%', 'ICA - 0.966%']);
  });

  it('con dos marcadas hay dos selects independientes (mismo impuesto permitido)', async () => {
    await setup('SALE');
    click('RETE_IVA');
    click('AUTO_RENTA');
    expect(taxSelects().length).toBe(2);
    component.onWithholdingTaxChange('RETE_IVA', '1');
    expect(component.withholdingTaxes()['RETE_IVA']).toBe('1');
    expect(component.withholdingTaxes()['AUTO_RENTA'] ?? null).toBeNull();
    component.onWithholdingTaxChange('AUTO_RENTA', '1');
    expect(component.withholdingTaxes()).toEqual({ RETE_IVA: '1', AUTO_RENTA: '1' });
  });

  it('al desmarcar desaparece el select y se limpia la selección', async () => {
    await setup('SALE');
    click('RETE_FUENTE');
    component.onWithholdingTaxChange('RETE_FUENTE', '2');
    click('RETE_FUENTE');
    expect(taxSelect('RETE_FUENTE')).toBeNull();
    expect(component.withholdingTaxes()['RETE_FUENTE'] ?? null).toBeNull();
    click('RETE_FUENTE');
    expect(component.withholdingTaxes()['RETE_FUENTE'] ?? null).toBeNull();
  });

  it('lista vacía muestra el aviso', async () => {
    await setup('SALE', {}, []);
    click('RETE_ICA');
    expect(q('withholding-tax-empty')?.textContent).toContain('No hay impuestos creados en la empresa');
  });

  it('en emitida no hay selects de impuesto', async () => {
    await setup('SALE', { status: 'EMITIDA', number: 'FV-1' });
    expect(taxSelects().length).toBe(0);
  });

  // --- totales y vistas ---
  // Subtotal 20.000 (2.000.000 centavos) + IVA 15% = 3.000
  const big = { ...line, cantidad: 1, precioUnitarioCents: 2000000, precioCatalogoCents: 2000000, ivaPct: 15, ivaCatalogoPct: 15 };
  const taxes3: BillingTax[] = [{ id: '3', name: 'ICA', rate: 20 }, { id: '4', name: 'Fuente', rate: 10 }];
  const rows = () => Array.from(el().querySelectorAll('[data-testid="withholding-row"]')).map((r) => r.textContent?.replace(/\s+/g, ' ').trim());

  it('ejemplo: 20.000 + 3.000 − ReteICA 20% (4.000) − ReteFuente 10% (2.000) = 17.000, en vivo y antes de guardar', async () => {
    await setup('SALE', { lines: [big], payment: { methodId: '7' } }, taxes3);
    component.toggleWithholding('RETE_ICA', true);
    component.onWithholdingTaxChange('RETE_ICA', '3');
    component.toggleWithholding('RETE_FUENTE', true);
    component.onWithholdingTaxChange('RETE_FUENTE', '4');
    fixture.detectChanges();
    expect(component.withholdingRows().map((r) => r.amountCents)).toEqual([400000, 200000]);
    expect(component.totals()).toEqual({ subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 600000, totalCents: 1700000 });
    expect(rows().length).toBe(2);
    expect(rows()[0]).toContain('ReteICA');
    expect(rows()[0]).toMatch(/-\s?\$?\s?4\.000/);
    expect(rows()[1]).toContain('ReteFuente');
    expect(q('summary-total')?.textContent).toMatch(/17\.000/);
  });

  it('restaura casillas y selects del borrador desde withholdings del response', async () => {
    const withholdings = [{ code: 'RETE_ICA', taxId: '2', taxName: 'ICA', ratePct: 0.97, amountCents: 1940 }];
    await setup('SALE', { withholdings, totals: { subtotalCents: 2000, ivaCents: 380, withholdingsCents: 1940, totalCents: 440 } });
    expect(component.withholdings()).toEqual(['RETE_ICA']);
    expect(component.withholdingTaxes()['RETE_ICA']).toBe('2');
    expect(taxSelect('RETE_ICA')).not.toBeNull();
    expect(taxSelect('RETE_IVA')).toBeNull();
    expect(el().querySelector('[data-testid="withholding-RETE_ICA"] input')).toBeTruthy();
    expect(component.withholdingPayload()).toEqual([{ code: 'RETE_ICA', taxId: '2' }]);
  });

  it('una retención restaurada cuyo impuesto ya no está en el catálogo sigue visible en el select', async () => {
    const withholdings = [{ code: 'RETE_IVA', taxId: '99', taxName: 'Viejo', ratePct: 5, amountCents: 100 }];
    await setup('SALE', { withholdings });
    expect(component.taxOptions().map((o) => o.label)).toContain('Viejo - 5%');
  });

  it('casilla marcada sin impuesto: no cuenta en el total y bloquea Emitir con aviso claro', async () => {
    await setup('SALE', { lines: [big], payment: { methodId: '7' } });
    const messages = TestBed.inject(MessageService);
    const add = spyOn(messages, 'add');
    const api = TestBed.inject(BillingSaleInvoiceApi) as unknown as { emit: jasmine.Spy };
    const emit = spyOn(api, 'emit').and.callThrough();
    component.toggleWithholding('RETE_IVA', true);
    fixture.detectChanges();
    expect(component.withholdingRows()).toEqual([]);
    expect(component.totals().totalCents).toBe(2300000);
    expect(q('missing-tax-hint')).not.toBeNull();
    component.confirmEmit();
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn', detail: 'Elige el impuesto de ReteIVA.' }));
    expect(emit).not.toHaveBeenCalled();
  });

  it('retenciones mayores que subtotal + IVA bloquean Emitir', async () => {
    await setup('SALE', { lines: [big], payment: { methodId: '7' } }, [{ id: '9', name: 'Enorme', rate: 100 }]);
    const add = spyOn(TestBed.inject(MessageService), 'add');
    component.toggleWithholding('RETE_IVA', true);
    component.onWithholdingTaxChange('RETE_IVA', '9');
    component.toggleWithholding('RETE_ICA', true);
    component.onWithholdingTaxChange('RETE_ICA', '9');
    component.confirmEmit();
    expect(component.totals().totalCents).toBe(-1700000);
    expect(add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn', summary: 'No se puede emitir' }));
  });

  it('los valores del back mandan sobre el cálculo local cuando coinciden subtotal y selección', async () => {
    const withholdings = [{ code: 'RETE_ICA', taxId: '3', taxName: 'ICA (back)', ratePct: 20, amountCents: 123 }];
    await setup('SALE', { lines: [big], withholdings, totals: { subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 123, totalCents: 2299877 } }, taxes3);
    expect(component.withholdingRows()[0]).toEqual(jasmine.objectContaining({ taxName: 'ICA (back)', amountCents: 123 }));
    expect(component.totals().totalCents).toBe(2299877);
  });

  it('emitida: snapshot congelado, solo lectura (sin casillas ni selects) y total neto del back', async () => {
    const withholdings = [
      { code: 'RETE_ICA', taxId: '3', taxName: 'ICA', ratePct: 20, amountCents: 400000 },
      { code: 'RETE_FUENTE', taxId: '4', taxName: 'Fuente', ratePct: 10, amountCents: 200000 },
    ];
    await setup('SALE', {
      status: 'EMITIDA', number: 'FV-1', lines: [big], withholdings,
      totals: { subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 600000, totalCents: 1700000 },
    }, taxes3);
    expect(q('withholdings')).toBeNull();
    expect(taxSelects().length).toBe(0);
    expect(rows().length).toBe(2);
    expect(rows()[0]).toContain('ReteICA');
    expect(q('summary-total')?.textContent).toMatch(/17\.000/);
  });

  it('compra: sin AutoRenta ni siquiera en el payload', async () => {
    await setup('PURCHASE', { supplierInvoiceNumber: 'F-1' }, taxes3);
    component.toggleWithholding('AUTO_RENTA', true);
    component.onWithholdingTaxChange('AUTO_RENTA', '3');
    expect(component.withholdingPayload()).toEqual([]);
  });
});
