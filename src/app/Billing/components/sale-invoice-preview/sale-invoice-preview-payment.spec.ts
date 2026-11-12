import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { SaleInvoiceLine } from '../../models/billing-sale-invoice.model';
import { SaleInvoicePreviewComponent } from './sale-invoice-preview.component';

const line: SaleInvoiceLine = {
  productId: 'p1',
  productName: 'Producto',
  cantidad: 1,
  precioCatalogoCents: 100000,
  precioUnitarioCents: 100000,
  ivaCatalogoPct: 19,
  ivaPct: 19,
};

const render = (inputs: Record<string, unknown>): HTMLElement => {
  TestBed.configureTestingModule({ providers: [provideNoopAnimations(), MessageService] });
  const fixture = TestBed.createComponent(SaleInvoicePreviewComponent);
  const base = { status: 'EMITIDA', date: '2026-11-09', lines: [line], kind: 'SALE', ...inputs };
  for (const [k, v] of Object.entries(base)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

const paymentLine = (el: HTMLElement): string | null =>
  el.querySelector('[data-testid="preview-payment"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

describe('Vista previa / PDF de la factura de venta: método de pago', () => {
  it('"Método de pago: Efectivo"', () => {
    const el = render({ payment: { methodId: '7', methodName: 'Efectivo' } });
    expect(paymentLine(el)).toBe('Método de pago: Efectivo');
  });

  it('sin rastro de banco aunque lleguen campos de banco', () => {
    const el = render({
      payment: { methodId: '9', methodName: 'Transferencia', bankAccountId: '3', bankAccountName: 'Banco ····7890' } as never,
    });
    expect(paymentLine(el)).toBe('Método de pago: Transferencia');
    expect(el.textContent).not.toContain('Banco');
  });

  it('venta anterior a este dato (sin método): muestra "—" sin romper la hoja', () => {
    const el = render({ payment: null });
    expect(paymentLine(el)).toBe('Método de pago: —');
    expect(el.textContent).toContain('Producto');
  });

  it('la línea está DENTRO de la hoja que se captura para el PDF', () => {
    const el = render({ payment: { methodName: 'Efectivo' } });
    const sheet = el.querySelector('div.relative.mx-auto') as HTMLElement;
    expect(sheet.contains(el.querySelector('[data-testid="preview-payment"]'))).toBeTrue();
  });

  it('la factura de compra muestra el método de pago', () => {
    const el = render({ kind: 'PURCHASE', supplierInvoiceNumber: 'F-1', payment: { methodName: 'Efectivo' } });
    expect(paymentLine(el)).toBe('Método de pago: Efectivo');
  });

  it('compra antigua sin método muestra "—"', () => {
    const old = render({ kind: 'PURCHASE', supplierInvoiceNumber: 'F-1', payment: null });
    expect(paymentLine(old)).toBe('Método de pago: —');
  });
});
