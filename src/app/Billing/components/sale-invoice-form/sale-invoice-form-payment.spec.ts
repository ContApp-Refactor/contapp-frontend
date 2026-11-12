import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingPaymentCatalog } from '../../services/billing-payment-catalog';
import { BillingTaxCatalog } from '../../services/billing-tax-catalog';
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

describe('Formulario de factura de venta: solo método de pago (sin cuenta bancaria)', () => {
  let fixture: ComponentFixture<SaleInvoiceFormComponent>;
  let component: SaleInvoiceFormComponent;
  let saveDraft: jasmine.Spy;
  let messages: jasmine.Spy;
  let methods: unknown;

  const setup = async (kind: 'SALE' | 'PURCHASE', doc: Record<string, unknown>, catalogMethods: unknown = [
      { id: '7', name: 'Efectivo' },
      { id: '9', name: 'Transferencia' },
    ],
  ) => {
    methods = catalogMethods;
    saveDraft = jasmine.createSpy('saveDraft').and.callFake(() => of(invoice({ ...doc, version: 2 })));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideNoopAnimations(), provideHttpClient(), MessageService,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { kind }, paramMap: convertToParamMap({ id: 'i1' }) } } },
        {
          provide: BillingSaleInvoiceApi,
          useValue: {
            getById: () => of(structuredClone(invoice({ kind, ...doc }))), saveDraft, deleteDraft: () => of(undefined),
            emit: jasmine.createSpy('emit').and.returnValue(of(invoice({ ...doc, status: 'EMITIDA' }))), annul: () => of(invoice()),
          },
        },
        { provide: BillingSaleReturnApi, useValue: { listByInvoice: () => of([]), getAvailability: () => of([]) } },
        { provide: BillingProductCatalog, useValue: { getProducts: () => of([]) } },
        { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of(methods) } },
        { provide: BillingTaxCatalog, useValue: { getTaxes: () => of([]) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([{ id: 'c1', name: 'Cliente Uno', document: '1' }]) } },
      ],
    });
    fixture = TestBed.createComponent(SaleInvoiceFormComponent);
    component = fixture.componentInstance;
    messages = spyOn(TestBed.inject(MessageService), 'add');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const q = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  it('la sección existe en la factura de venta', async () => {
    await setup('SALE', {});
    expect(q('payment-method')).not.toBeNull();
  });

  it('la factura de compra también muestra el select y el enlace', async () => {
    await setup('PURCHASE', { supplierInvoiceNumber: 'F-1' });
    expect(q('payment-method')).not.toBeNull();
    expect(q('payment-methods-manage')?.textContent?.replace(/\s+/g, ' ')).toContain('Administrar métodos de pago');
    component.onPaymentMethodChange('9');
    expect(component.payment()).toEqual({ methodId: '9', methodName: 'Transferencia' });
  });

  it('compra: el enlace guarda y navega con returnTo a la factura de compra', async () => {
    await setup('PURCHASE', { supplierInvoiceNumber: 'F-1' });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.onPaymentMethodChange('7'); // borrador con cambios pendientes
    q('payment-methods-link')!.click();
    await fixture.whenStable();
    expect(saveDraft).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      ['/gen-masters/payment-methods/list'],
      { queryParams: jasmine.objectContaining({ returnTo: jasmine.stringMatching(/^\/billing\/purchase\//) }) },
    );
  });

  it('compra: emitir sin método se bloquea, y el autoguardado lo envía', async () => {
    await setup('PURCHASE', { supplierInvoiceNumber: 'F-1' });
    component.confirmEmit();
    expect(messages.calls.mostRecent().args[0].detail).toContain('método de pago');
    component.onPaymentMethodChange('7');
    await (component as unknown as { persist(): Promise<void> }).persist();
    expect(saveDraft.calls.mostRecent().args[0].payment).toEqual(jasmine.objectContaining({ methodId: '7' }));
  });

  it('compra emitida: método solo lectura con el nombre congelado y sin enlace', async () => {
    await setup('PURCHASE', { status: 'EMITIDA', number: 'FC-1', supplierInvoiceNumber: 'F-1', payment: { methodId: '9', methodName: 'Transferencia' } });
    expect(q('payment-method')?.textContent).toContain('Transferencia');
    expect(q('payment-methods-link')).toBeNull();
  });

  it('ya no hay forma de pago, plazo ni vencimiento', async () => {
    await setup('SALE', {});
    expect(q('payment-form')).toBeNull();
    expect(q('payment-term')).toBeNull();
    expect(q('payment-due-date')).toBeNull();
  });

  it('el pago lleva solo el método y ya no existe el selector de banco, sea cual sea el método', async () => {
    await setup('SALE', {});
    for (const id of ['7', '9']) {
      component.onPaymentMethodChange(id);
      fixture.detectChanges();
      expect(q('payment-bank-account')).toBeNull();
      expect(fixture.nativeElement.querySelector('#paymentBankAccount')).toBeNull();
    }
    expect(component.payment()).toEqual({ methodId: '9', methodName: 'Transferencia' });
    expect('bankAccountId' in component).toBeFalse();
    expect('onBankAccountChange' in component).toBeFalse();
  });

  it('el autoguardado envía solo el método', async () => {
    await setup('SALE', {});
    component.onPaymentMethodChange('9');
    await (component as unknown as { persist(): Promise<void> }).persist();
    const sent = saveDraft.calls.mostRecent().args[0];
    expect(sent.payment).toEqual(jasmine.objectContaining({ methodId: '9' }));
    expect(sent.payment.bankAccountId).toBeUndefined();
  });

  it('el enlace "Administrar métodos de pago" aparece siempre en borrador, con o sin métodos', async () => {
    await setup('SALE', {});
    expect(q('payment-methods-manage')?.textContent?.replace(/\s+/g, ' ')).toContain('Administrar métodos de pago');
    TestBed.resetTestingModule();
    await setup('SALE', {}, []);
    expect(q('payment-methods-link')).not.toBeNull();
  });

  it('el enlace guarda el borrador y navega a Métodos de Pago', async () => {
    await setup('SALE', {});
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.onPaymentMethodChange('7'); // borrador con cambios pendientes
    q('payment-methods-link')!.click();
    await fixture.whenStable();
    expect(saveDraft).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      ['/gen-masters/payment-methods/list'],
      { queryParams: jasmine.objectContaining({ returnTo: jasmine.stringMatching(/^\/billing\//) }) },
    );
  });

  it('el enlace no aparece en facturas emitidas ni anuladas', async () => {
    await setup('SALE', { status: 'EMITIDA', number: 'FV-1', payment: { methodId: '9', methodName: 'Transferencia' } });
    expect(q('payment-methods-link')).toBeNull();
    TestBed.resetTestingModule();
    await setup('SALE', { status: 'ANULADA', number: 'FV-1', payment: { methodId: '9', methodName: 'Transferencia' } });
    expect(q('payment-methods-link')).toBeNull();
  });

  it('sin métodos de pago: mensaje con el camino para crearlos', async () => {
    await setup('SALE', {}, []);
    expect(q('payment-methods-empty')?.textContent).toContain(
      'No hay métodos de pago. Créalos en Maestros Generales > Métodos de Pago',
    );
  });

  it('emitir sin método de pago se bloquea con un aviso claro y no llama al back', async () => {
    await setup('SALE', {});
    component.confirmEmit();
    expect(messages.calls.mostRecent().args[0].detail).toContain('método de pago');
  });

  it('un borrador cargado con método lo restaura; los campos de banco que lleguen se ignoran', async () => {
    await setup('SALE', { payment: { methodId: '9', bankAccountId: '3' } });
    fixture.detectChanges();
    expect(component.paymentMethodId()).toBe('9');
    expect(q('payment-bank-account')).toBeNull();
  });

  it('con la factura emitida el método es solo lectura (nombre congelado) y sin banco', async () => {
    await setup('SALE', {
      status: 'EMITIDA',
      number: 'FV-1',
      payment: { methodId: '9', methodName: 'Transferencia', bankAccountId: '3', bankAccountName: 'Banco ····7890' },
    });
    expect(q('payment-method')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="payment-method"] p-dropdown')).toBeNull();
    expect(q('payment-bank-account')).toBeNull();
    expect(component.paymentMethodLabel()).toBe('Transferencia');
    expect(component.payment()).toEqual({ methodId: '9', methodName: 'Transferencia' });
  });
});
