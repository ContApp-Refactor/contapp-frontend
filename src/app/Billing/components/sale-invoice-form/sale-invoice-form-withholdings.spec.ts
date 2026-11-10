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

describe('Formulario de factura: retenciones (solo UI)', () => {
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

  it('marcar casillas no guarda el borrador', async () => {
    await setup('SALE');
    component.toggleWithholding('RETE_IVA', true);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 1500));
    expect(saveDraft).not.toHaveBeenCalled();
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
});
