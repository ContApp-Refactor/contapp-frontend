import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingProductCatalog } from '../../services/billing-product-catalog';
import { BillingPaymentCatalog } from '../../services/billing-payment-catalog';
import { BillingTaxCatalog } from '../../services/billing-tax-catalog';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { DUPLICATE_SUPPLIER_INVOICE_CODE } from '../../utils/billing-error';
import { SaleInvoiceFormComponent } from './sale-invoice-form.component';

// Un N.º de factura del proveedor repetido NO rompe la pantalla: el autosave falla, se muestra el mensaje bajo el campo,
// el estado no miente ("No se pudo guardar") y al corregir el número el siguiente autosave guarda y limpia el aviso.
describe('Formulario de factura de compra: N.º de factura del proveedor duplicado', () => {
  const MESSAGE = 'Ya existe una factura de compra de este proveedor con el N.º 1234. Usa un número diferente.';
  const draft = {
    id: 'p1', number: null, status: 'BORRADOR', kind: 'PURCHASE', clientId: 's1', clientName: 'Proveedor Uno',
    supplierInvoiceNumber: '', date: '2026-10-01', createdAt: '', updatedAt: '', version: 1, lines: [],
  };
  const duplicate = () =>
    new HttpErrorResponse({ status: 409, error: { code: DUPLICATE_SUPPLIER_INVOICE_CODE, message: MESSAGE } });

  let fixture: ComponentFixture<SaleInvoiceFormComponent>;
  let component: SaleInvoiceFormComponent;
  let saveDraft: jasmine.Spy;
  let messages: MessageService;

  beforeEach(() => {
    saveDraft = jasmine.createSpy('saveDraft').and.callFake((req: { supplierInvoiceNumber?: string }) =>
      req.supplierInvoiceNumber === '1234' ? throwError(duplicate) : of({ ...structuredClone(draft), supplierInvoiceNumber: req.supplierInvoiceNumber }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideNoopAnimations(), provideHttpClient(), MessageService,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { kind: 'PURCHASE' }, paramMap: convertToParamMap({ id: 'p1' }) } } },
        { provide: BillingSaleInvoiceApi, useValue: {
          getById: () => of(structuredClone(draft)), saveDraft, deleteDraft: () => of(undefined), emit: () => of(draft), annul: () => of(draft) } },
        { provide: BillingSaleReturnApi, useValue: { listByInvoice: () => of([]), getAvailability: () => of([]) } },
        { provide: BillingProductCatalog, useValue: { getProducts: () => of([]) } },
        { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of([{ id: '7', name: 'Efectivo' }]) } },
        { provide: BillingTaxCatalog, useValue: { getTaxes: () => of([]) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([{ id: 's1', name: 'Proveedor Uno', document: '1' }]) } },
      ],
    });
    messages = TestBed.inject(MessageService);
    fixture = TestBed.createComponent(SaleInvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const errorText = (): string | null =>
    fixture.nativeElement.querySelector('[role="alert"]')?.textContent?.trim() ?? null;

  it('muestra el mensaje bajo el campo, deja el estado en error y avisa con un toast, sin romper la pantalla', fakeAsync(() => {
    const toasts: string[] = [];
    messages.messageObserver.subscribe((m) => toasts.push(String((Array.isArray(m) ? m[0] : m).detail)));

    component.onSupplierInvoiceNumberChange('1234');
    tick(1000);
    fixture.detectChanges();

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(component.saveState()).toBe('error');
    expect(component.supplierNumberError()).toBe(MESSAGE);
    expect(errorText()).toBe(MESSAGE);
    expect(fixture.nativeElement.textContent).toContain('No se pudo guardar');
    expect(toasts.some((t) => t.includes(MESSAGE))).toBeTrue();
  }));

  it('al corregir el número el aviso desaparece y el autosave guarda', fakeAsync(() => {
    component.onSupplierInvoiceNumberChange('1234');
    tick(1000);
    fixture.detectChanges();
    expect(errorText()).toBe(MESSAGE);

    component.onSupplierInvoiceNumberChange('1235');
    fixture.detectChanges();
    expect(errorText()).toBeNull(); // se limpia apenas el usuario corrige
    tick(1000);
    fixture.detectChanges();

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(component.saveState()).toBe('saved');
    expect(component.supplierNumberError()).toBeNull();
    expect(errorText()).toBeNull();
  }));
});
