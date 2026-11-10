import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { SaleInvoiceDraftInput } from '../models/billing-sale-invoice.model';
import { BillingCounterpartyCatalog } from './billing-counterparty-catalog';
import { BillingPaymentCatalog } from './billing-payment-catalog';
import { BillingProductCatalog } from './billing-product-catalog';
import { MockBillingSaleInvoiceApi } from './mock-billing-sale-invoice.api';

const INVOICES_KEY = 'billing_sale_invoices';
const SEQ_KEYS = ['billing_sale_invoice_seq', 'billing_purchase_invoice_seq'];
const ENT_KEY = 'entData';

describe('MockBillingSaleInvoiceApi: método de pago, sin banco (sincronizado con el back)', () => {
  let api: MockBillingSaleInvoiceApi;

  beforeEach(() => {
    localStorage.removeItem(INVOICES_KEY);
    SEQ_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(ENT_KEY, JSON.stringify({ id: 'e1', name: 'Empresa Uno', nit: '900', logo: '' }));
    TestBed.configureTestingModule({
      providers: [
        MockBillingSaleInvoiceApi,
        { provide: BillingProductCatalog, useValue: { getProducts: () => of([{ id: 'p1', code: 'P1', name: 'Prod', priceCents: 1000, ivaPct: 5 }]) } },
        { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([{ id: 'c1', name: 'Cliente', document: '1' }]) } },
        {
          provide: BillingPaymentCatalog,
          useValue: {
            getPaymentMethods: () =>
              of([
                { id: '7', name: 'Efectivo' },
                { id: '9', name: 'Transferencia' },
              ]),
          },
        },
      ],
    });
    api = TestBed.inject(MockBillingSaleInvoiceApi);
  });

  afterEach(() => {
    localStorage.removeItem(INVOICES_KEY);
    SEQ_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(ENT_KEY);
  });

  const draft = (over: Partial<SaleInvoiceDraftInput> = {}): SaleInvoiceDraftInput => ({
    kind: 'SALE',
    clientId: 'c1',
    date: '2026-11-09',
    lines: [{ productId: 'p1', productName: 'Prod', cantidad: 1, precioUnitarioCents: 1000, ivaPct: null }] as never,
    ...over,
  });

  const codeOf = (e: unknown): string | undefined => (e instanceof HttpErrorResponse ? e.error?.code : undefined);

  it('un borrador conserva solo el método (descarta campos de banco)', async () => {
    const saved = await firstValueFrom(api.saveDraft(draft({ payment: { methodId: '7', bankAccountId: '3' } as never })));
    expect(saved.payment).toEqual({ methodId: '7', methodName: null });
    const none = await firstValueFrom(api.saveDraft(draft({ payment: { methodId: null } })));
    expect(none.payment).toEqual({ methodId: null, methodName: null });
  });

  it('emitir una venta sin pago falla con BILLING_PAYMENT_METHOD_REQUIRED', async () => {
    const saved = await firstValueFrom(api.saveDraft(draft()));
    const error = await firstValueFrom(api.emit(saved.id, saved.version)).catch((e) => e);
    expect(codeOf(error)).toBe('BILLING_PAYMENT_METHOD_REQUIRED');
  });

  it('emitir sin método elegido falla con BILLING_PAYMENT_METHOD_REQUIRED', async () => {
    const saved = await firstValueFrom(api.saveDraft(draft({ payment: { methodId: null } })));
    const error = await firstValueFrom(api.emit(saved.id, saved.version)).catch((e) => e);
    expect(codeOf(error)).toBe('BILLING_PAYMENT_METHOD_REQUIRED');
  });

  it('emitir con un método que ya no está activo falla con BILLING_PAYMENT_METHOD_INVALID', async () => {
    const saved = await firstValueFrom(api.saveDraft(draft({ payment: { methodId: '99' } })));
    const error = await firstValueFrom(api.emit(saved.id, saved.version)).catch((e) => e);
    expect(codeOf(error)).toBe('BILLING_PAYMENT_METHOD_INVALID');
  });

  it('emitir con cualquier método válido congela solo el nombre del método (sin banco)', async () => {
    for (const [id, name] of [['7', 'Efectivo'], ['9', 'Transferencia']]) {
      const saved = await firstValueFrom(api.saveDraft(draft({ payment: { methodId: id } })));
      const emitted = await firstValueFrom(api.emit(saved.id, saved.version));
      expect(emitted.status).toBe('EMITIDA');
      expect(emitted.payment).toEqual({ methodId: id, methodName: name });
    }
  });

  it('la compra guarda el pago, lo exige al emitir y congela el nombre', async () => {
    const sin = await firstValueFrom(api.saveDraft(draft({ kind: 'PURCHASE', supplierInvoiceNumber: 'F-1' })));
    let code: string | undefined;
    try {
      await firstValueFrom(api.emit(sin.id, sin.version));
    } catch (e) {
      code = codeOf(e);
    }
    expect(code).toBe('BILLING_PAYMENT_METHOD_REQUIRED');
    const saved = await firstValueFrom(
      api.saveDraft(draft({ id: sin.id, version: sin.version, kind: 'PURCHASE', supplierInvoiceNumber: 'F-1', payment: { methodId: '7' } })),
    );
    expect(saved.payment).toEqual({ methodId: '7', methodName: null });
    const emitted = await firstValueFrom(api.emit(saved.id, saved.version));
    expect(emitted.status).toBe('EMITIDA');
    expect(emitted.payment).toEqual({ methodId: '7', methodName: 'Efectivo' });
  });
});
