import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { SaleInvoice, SaleInvoiceDraftInput } from '../models/billing-sale-invoice.model';
import { BillingHttpSaleInvoiceApi, toDraftBody } from './billing-http-sale-invoice.api';

const input = (over: Partial<SaleInvoiceDraftInput> = {}): SaleInvoiceDraftInput => ({
  kind: 'SALE',
  clientId: 'c1',
  date: '2026-11-09',
  lines: [],
  ...over,
});

describe('toDraftBody: pago (solo venta)', () => {
  it('venta con método: envía solo {methodId}, nunca el nombre', () => {
    const body = toDraftBody(input({ payment: { methodId: '7', methodName: 'Efectivo' } })) as Record<string, unknown>;
    expect(body['payment']).toEqual({ methodId: '7' });
  });

  it('venta: nunca envía campos de banco aunque el input los traiga', () => {
    const body = toDraftBody(
      input({ payment: { methodId: '9', methodName: 'Transferencia', bankAccountId: '3', bankAccountName: 'Banco' } as never }),
    ) as Record<string, unknown>;
    expect(body['payment']).toEqual({ methodId: '9' });
  });

  it('venta sin método elegido: payment null (el borrador puede estar incompleto)', () => {
    expect((toDraftBody(input()) as Record<string, unknown>)['payment']).toBeNull();
  });

  it('compra: payment viaja como { methodId }', () => {
    const body = toDraftBody(input({ kind: 'PURCHASE', payment: { methodId: '7' } })) as Record<string, unknown>;
    expect(body['payment']).toEqual({ methodId: '7' });
  });
});

describe('BillingHttpSaleInvoiceApi: pago', () => {
  let api: BillingHttpSaleInvoiceApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BillingHttpSaleInvoiceApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LocalStorageMethods, useValue: { getIdEnterprise: () => 'ent-1' } },
      ],
    });
    api = TestBed.inject(BillingHttpSaleInvoiceApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('el PUT del borrador de venta lleva {methodId} y la respuesta vuelve con methodName', () => {
    let result: SaleInvoice | undefined;
    api.saveDraft(input({ id: 'i1', payment: { methodId: '9' }, version: 2 })).subscribe((r) => (result = r));
    const req = httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/billing/sale-invoices/i1');
    expect((req.request.body as { payment: unknown }).payment).toEqual({ methodId: '9' });
    req.flush({ id: 'i1', kind: 'SALE', payment: { methodId: '9', methodName: 'Transferencia' } });
    expect(result?.payment?.methodName).toBe('Transferencia');
  });

  it('el PUT de un borrador de compra envía payment', () => {
    api.saveDraft(input({ id: 'p1', kind: 'PURCHASE', payment: { methodId: '7' } })).subscribe();
    const req = httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/billing/purchase-invoices/p1');
    expect((req.request.body as { payment: unknown }).payment).toEqual({ methodId: '7' });
    req.flush({ id: 'p1', kind: 'PURCHASE' });
  });

  it('leer una venta anterior al dato (payment ausente o null) no rompe', () => {
    let result: SaleInvoice | undefined;
    api.getById('old').subscribe((r) => (result = r));
    httpMock.expectOne('/api/billing/sale-invoices/old?enterpriseId=ent-1').flush({ id: 'old', kind: 'SALE', payment: null });
    expect(result?.payment).toBeNull();
  });
});
