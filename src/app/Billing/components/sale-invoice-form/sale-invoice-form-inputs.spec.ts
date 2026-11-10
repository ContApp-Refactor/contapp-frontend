import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { InputNumber } from 'primeng/inputnumber';
import { of } from 'rxjs';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingProductCatalog } from '../../services/billing-product-catalog';
import { BillingPaymentCatalog } from '../../services/billing-payment-catalog';
import { BillingTaxCatalog } from '../../services/billing-tax-catalog';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { SaleInvoiceFormComponent } from './sale-invoice-form.component';

// Edición por EVENTOS reales del input (teclas y blur) con la plantilla completa: p-inputNumber emite el modelo en cada
// tecla; la fila no debe recrearse ni revertirse mientras se teclea, y el valor se normaliza al salir del campo.
describe('Formulario de factura: edición con teclado de cantidad, precio e IVA', () => {
  const draft = {
    id: 'i1', number: null, status: 'BORRADOR', kind: 'SALE', clientId: 'c1', clientName: 'Cliente Uno', date: '2026-10-01',
    createdAt: '', updatedAt: '', version: 1,
    lines: [
      {
        lineNo: 1, productId: 'a', productName: 'Prod a', cantidad: 2, precioCatalogoCents: 1000, precioUnitarioCents: 1500,
        precioEditado: true, ivaCatalogoPct: 19, ivaPct: 5, ivaEditado: true,
      },
    ],
  };
  let fixture: ComponentFixture<SaleInvoiceFormComponent>;
  let component: SaleInvoiceFormComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideNoopAnimations(), provideHttpClient(), MessageService,
        { provide: ActivatedRoute, useValue: { snapshot: { data: { kind: 'SALE' }, paramMap: convertToParamMap({ id: 'i1' }) } } },
        { provide: BillingSaleInvoiceApi, useValue: {
          getById: () => of(structuredClone(draft)), saveDraft: () => of(structuredClone(draft)),
          deleteDraft: () => of(undefined), emit: () => of(draft), annul: () => of(draft) } },
        { provide: BillingSaleReturnApi, useValue: { listByInvoice: () => of([]), getAvailability: () => of([]) } },
        { provide: BillingProductCatalog, useValue: { getProducts: () => of([]) } },
        { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of([]) } },
        { provide: BillingTaxCatalog, useValue: { getTaxes: () => of([]) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([{ id: 'c1', name: 'Cliente Uno', document: '1' }]) } },
      ],
    });
    fixture = TestBed.createComponent(SaleInvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  const cell = (n: number): HTMLInputElement =>
    fixture.nativeElement.querySelector(`p-table tbody tr:first-child td:nth-child(${n}) input`) as HTMLInputElement;
  const field = (n: number): InputNumber =>
    fixture.debugElement.queryAll(By.directive(InputNumber))[n === 3 ? 0 : n === 5 ? 1 : 2].componentInstance;
  const decimalChar = (): string => (field(3) as unknown as { _decimalChar: string })._decimalChar;

  const type = (input: HTMLInputElement, text: string) => {
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      input.dispatchEvent(new KeyboardEvent('keypress', { keyCode: code, which: code, bubbles: true, cancelable: true } as KeyboardEventInit));
      fixture.detectChanges();
    }
  };
  const clear = (input: HTMLInputElement) => {
    input.value = '';
    input.setSelectionRange(0, 0);
  };
  const blur = (input: HTMLInputElement) => {
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  // Antes se tecleaba "0,5": hoy Inventario solo admite cantidades enteras (mínimo 1)
  it('se puede teclear una cantidad entera: el "0" intermedio no se revierte y la fila no se recrea', () => {
    const input = cell(3);
    expect(input.value).toBe('2');
    clear(input);
    type(input, '0');
    expect(component.lines()[0].cantidad).toBe(2); // el 0 intermedio se ignora (no pisa ni revierte)
    expect(cell(3)).toBe(input); // mismo nodo: la fila/input no se recreó (conserva el foco)
    expect(input.value).toBe('0'); // sigue mostrando lo tecleado
    clear(input);
    type(input, '7');
    expect(component.lines()[0].cantidad).toBe(7);
    expect(cell(3)).toBe(input);
    blur(input);
    expect(component.lines()[0].cantidad).toBe(7);
    expect(cell(3).value).toBe('7');
  });

  it('no se pueden teclear decimales en la cantidad: queda un entero', () => {
    const input = cell(3);
    clear(input);
    // Con maxFractionDigits=0 el input no tiene separador decimal (_decimalChar vacío): "3,5" / "3.5" no producen fracción
    expect(decimalChar()).toBe('');
    type(input, '3.5');
    blur(input);
    let cantidad = component.lines()[0].cantidad;
    expect(Number.isInteger(cantidad)).toBeTrue();
    expect(cantidad).toBeGreaterThanOrEqual(1);
    expect(cell(3).value).toBe(field(3).formatValue(cantidad));

    clear(input);
    type(input, '3,5');
    blur(input);
    cantidad = component.lines()[0].cantidad;
    expect(Number.isInteger(cantidad)).toBeTrue();
  });

  it('al salir del campo, una cantidad vacía o 0 vuelve al último valor válido', () => {
    const input = cell(3);
    clear(input);
    blur(input);
    expect(component.lines()[0].cantidad).toBe(2);
    expect(cell(3).value).toBe('2');

    clear(input);
    type(input, '0');
    blur(input);
    expect(component.lines()[0].cantidad).toBe(2);
    expect(cell(3).value).toBe('2');
  });

  it('vaciar el precio y salir del campo vuelve al catálogo (precioEditado=false), nunca a $0', () => {
    const input = cell(5);
    clear(input);
    blur(input);
    const line = component.lines()[0];
    expect(line.precioUnitarioCents).toBe(1000);
    expect(line.precioEditado).toBeFalse();
    expect(cell(5).value).toMatch(/10/); // muestra el precio de catálogo, no 0
    expect(cell(5).value).not.toMatch(/^\D*0\D*$/);
  });

  it('teclear un precio lo marca como editado y vaciar el IVA vuelve al catálogo al salir', () => {
    const price = cell(5);
    clear(price);
    type(price, '12');
    expect(component.lines()[0].precioUnitarioCents).toBe(1200);
    expect(component.lines()[0].precioEditado).toBeTrue();
    expect(cell(5)).toBe(price);

    const iva = cell(6);
    clear(iva);
    blur(iva);
    expect(component.lines()[0].ivaPct).toBe(19);
    expect(component.lines()[0].ivaEditado).toBeFalse();
  });
});
