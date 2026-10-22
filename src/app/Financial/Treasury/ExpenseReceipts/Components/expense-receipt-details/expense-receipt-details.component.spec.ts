import { of, throwError } from 'rxjs';

import { ExpenseReceiptDetailView } from '../../Model/ExpenseReceiptView';
import { ExpenseReceiptDetailsComponent } from './expense-receipt-details.component';

describe('ExpenseReceiptDetailsComponent product lines', () => {
  function detail(): ExpenseReceiptDetailView {
    return {
      invoiceId: 11,
      sourceInvoiceId: 501,
      amountPaid: 90000,
      invoiceCode: '678151694',
      invoiceValue: 100000,
      retentionsApplied: 10000,
      payableAccountCode: '220501',
      remainingBalance: 0,
    };
  }

  function component(service: object): ExpenseReceiptDetailsComponent {
    return new ExpenseReceiptDetailsComponent(
      null as any,
      null as any,
      service as any,
      null as any,
      null as any,
    );
  }

  it('uses the obligation id, preserves the resolved source id and renders returned products', () => {
    const productLines = [{
      productLabel: 'Mantenimiento',
      quantity: 1,
      unitPrice: 80000,
      subtotal: 80000,
      discountPercent: 0,
      discountAmount: 0,
      taxLabel: '19%',
      taxAmount: 15200,
      lineTotal: 95200,
    }];
    const service = {
      getPaidInvoiceProductLinesForObligation: jasmine.createSpy().and.returnValue(of({
        sourceInvoiceId: 777,
        lines: productLines,
      })),
    };
    const target = detail();

    component(service).toggleProducts(target);

    expect(service.getPaidInvoiceProductLinesForObligation).toHaveBeenCalledWith(11);
    expect(target.sourceInvoiceId).toBe(777);
    expect(target.productLines).toBe(productLines);
  });

  it('shows the explicit empty state when the invoice has no products', () => {
    const service = {
      getPaidInvoiceProductLinesForObligation: jasmine.createSpy().and.returnValue(of({
        sourceInvoiceId: 501,
        lines: [],
      })),
    };
    const target = detail();
    const subject = component(service);

    subject.toggleProducts(target);

    expect(subject.productsError(target)).toBe(
      'La factura no tiene productos o servicios registrados.',
    );
  });

  it('reports an HTTP failure separately from an empty product list', () => {
    const service = {
      getPaidInvoiceProductLinesForObligation: jasmine.createSpy().and.returnValue(
        throwError(() => ({ status: 503 })),
      ),
    };
    const target = detail();
    const subject = component(service);

    subject.toggleProducts(target);

    expect(target.productLines).toBeUndefined();
    expect(subject.productsError(target)).toBe(
      'No fue posible consultar los productos de la factura.',
    );
  });
});
