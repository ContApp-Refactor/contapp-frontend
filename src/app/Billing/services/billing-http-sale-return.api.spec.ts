import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { SaleReturn, SaleReturnDraftInput } from '../models/billing-sale-return.model';
import { BillingHttpSaleReturnApi } from './billing-http-sale-return.api';
import { IDEMPOTENCY_HEADER } from './idempotency-key.store';

const AVAILABILITY = {
  lines: [{ lineNo: 1, productId: 'p1', productName: 'P', sold: 5, returned: 0, available: 5, precioUnitarioCents: 100, ivaPct: 19 }],
};

const input = (over: Partial<SaleReturnDraftInput> = {}): SaleReturnDraftInput => ({
  invoiceId: 'inv-1',
  date: '2026-10-27',
  reason: 'defecto',
  lines: [{ lineNo: 1, cantidad: 1 }],
  ...over,
});

describe('BillingHttpSaleReturnApi (idempotencia)', () => {
  let api: BillingHttpSaleReturnApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BillingHttpSaleReturnApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LocalStorageMethods, useValue: { getIdEnterprise: () => 'ent-1' } },
      ],
    });
    api = TestBed.inject(BillingHttpSaleReturnApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // Solo la primera llamada consulta la disponibilidad para saber el tipo de la factura (venta); después el tipo
  // queda en el registro y el POST sale directo (las líneas ya viajan por lineNo, sin mapear por producto)
  const post = (probe = false): TestRequest => {
    if (probe) {
      httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/return-availability')).flush(AVAILABILITY);
    }
    return httpMock.expectOne((r) => r.method === 'POST' && r.url === '/api/billing/sale-returns');
  };

  it('el POST de creación envía el header Idempotency-Key', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const req = post(true);
    expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    req.flush(null, { status: 500, statusText: 'x' });
  });

  it('el reintento del mismo cuerpo reutiliza la clave y tras el éxito se renueva', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = post(true);
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush(null, { status: 0, statusText: 'red' });

    api.saveDraft(input()).subscribe({ error: () => undefined });
    const retry = post();
    expect(retry.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
    retry.flush(
      { id: 'r1', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv-1', lines: [], reason: '' },
      { status: 201, statusText: 'Created' },
    );

    api.saveDraft(input()).subscribe({ error: () => undefined });
    const next = post();
    expect(next.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    next.flush(null, { status: 500, statusText: 'x' });
  });

  it('un cuerpo distinto tras un error definitivo usa otra clave', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = post(true);
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush({ code: 'BILLING_VALIDATION' }, { status: 422, statusText: 'x' });

    api.saveDraft(input({ lines: [{ lineNo: 1, cantidad: 2 }] })).subscribe({ error: () => undefined });
    const changed = post();
    expect(changed.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    changed.flush(null, { status: 500, statusText: 'x' });
  });

  it('un cuerpo distinto tras un error SIN respuesta reenvía el original con la misma clave y luego hace PUT', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = post(true);
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    const originalBody = first.request.body;
    first.flush(null, { status: 0, statusText: 'red' });

    api.saveDraft(input({ lines: [{ lineNo: 1, cantidad: 2 }] })).subscribe({ error: () => undefined });
    const replay = post();
    expect(replay.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
    expect(replay.request.body).toEqual(originalBody);
    replay.flush({ id: 'r1', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv-1', lines: [], reason: '', version: 1 });
    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/billing/sale-returns/r1');
    expect((put.request.body as { lines: unknown[]; version: number }).lines).toEqual([{ sourceLineNo: 1, cantidad: 2 }]);
    expect((put.request.body as { version: number }).version).toBe(1);
    put.flush({ id: 'r1', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv-1', lines: [], reason: '', version: 2 });
  });

  it('forgetPendingCreation libera la clave de una creación sin respuesta: el reintento usa una nueva', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = post(true);
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush(null, { status: 0, statusText: 'red' });

    api.forgetPendingCreation('inv-1');

    api.saveDraft(input()).subscribe({ error: () => undefined });
    const retry = post();
    expect(retry.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    retry.flush(null, { status: 500, statusText: 'x' });
  });

  it('el body no incluye líneas con cantidad 0 y las demás viajan por sourceLineNo', () => {
    api
      .saveDraft(
        input({
          lines: [
            { lineNo: 1, cantidad: 2 },
            { lineNo: 2, cantidad: 0 },
            { lineNo: 3, cantidad: 1.5 },
          ],
        }),
      )
      .subscribe({ error: () => undefined });
    const req = post(true);
    expect((req.request.body as { lines: unknown[] }).lines).toEqual([
      { sourceLineNo: 1, cantidad: 2 },
      { sourceLineNo: 3, cantidad: 1.5 },
    ]);
    req.flush(null, { status: 500, statusText: 'x' });
  });

  it('si ninguna línea tiene cantidad el borrador viaja con lines vacío (el back exige líneas solo al emitir)', () => {
    api.saveDraft(input({ lines: [{ lineNo: 1, cantidad: 0 }] })).subscribe({ error: () => undefined });
    const req = post(true);
    expect((req.request.body as { lines: unknown[] }).lines).toEqual([]);
    req.flush(null, { status: 500, statusText: 'x' });
  });

  it('el PUT envía la versión en el body; DELETE la envía por query y emit/annul en el body', () => {
    api.saveDraft(input({ id: 'r1', version: 3 })).subscribe({ error: () => undefined });
    httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/return-availability')).flush(AVAILABILITY);
    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/billing/sale-returns/r1');
    expect((put.request.body as { version: number }).version).toBe(3);
    expect((put.request.body as { lines: unknown[] }).lines).toEqual([{ sourceLineNo: 1, cantidad: 1 }]);
    put.flush({ id: 'r1', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv-1', lines: [], reason: '', version: 4 });

    api.deleteDraft('r1', 4).subscribe();
    const del = httpMock.expectOne((r) => r.method === 'DELETE' && r.url === '/api/billing/sale-returns/r1');
    expect(del.request.params.get('version')).toBe('4');
    del.flush(null);

    api.emit('r1', 4).subscribe();
    const emit = httpMock.expectOne((r) => r.url.endsWith('/r1/emit'));
    expect(emit.request.body).toEqual({ version: 4 });
    emit.flush({ id: 'r1', kind: 'SALE', status: 'EMITIDA', invoiceId: 'inv-1', lines: [], reason: '', version: 5 });

    api.emit('r1').subscribe(); // sin versión conocida el body va vacío (el back no verifica)
    const emit2 = httpMock.expectOne((r) => r.url.endsWith('/r1/emit'));
    expect(emit2.request.body).toEqual({});
    emit2.flush({ id: 'r1', kind: 'SALE', status: 'EMITIDA', invoiceId: 'inv-1', lines: [], reason: '' });
  });

  it('guarda la versión, el totals y el sourceLineNo que devuelve el back', () => {
    let result: SaleReturn | undefined;
    api.getById('r9').subscribe((r) => (result = r));
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/billing/sale-returns/r9')
      .flush({
        id: 'r9',
        kind: 'SALE',
        status: 'EMITIDA',
        invoiceId: 'inv-1',
        reason: 'x',
        lines: [{ sourceLineNo: 2, productId: 'p1', productName: 'P', cantidadDevuelta: 1.5, precioUnitarioCents: 100, ivaPct: 19 }],
        totals: { subtotalCents: 150, ivaCents: 29, totalCents: 179 },
        version: 6,
      });
    expect(result?.version).toBe(6);
    expect(result?.totals).toEqual({ subtotalCents: 150, ivaCents: 29, totalCents: 179 });
    expect(result?.lines[0].sourceLineNo).toBe(2);
  });

  it('conserva el emisor y el tercero congelados de una devolución emitida; en borrador el emisor es null', () => {
    let emitted: SaleReturn | undefined;
    api.getById('r9').subscribe((r) => (emitted = r));
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/billing/sale-returns/r9')
      .flush({
        id: 'r9', kind: 'SALE', status: 'EMITIDA', invoiceId: 'inv-1', reason: 'x', lines: [],
        clientName: 'Cliente congelado', clientDocument: '123',
        issuer: { enterpriseId: 'e1', name: 'Emisor', nit: '900', dv: '1', active: true },
      });
    expect(emitted?.issuer).toEqual({ enterpriseId: 'e1', name: 'Emisor', nit: '900', dv: '1', active: true });
    expect(emitted?.clientDocument).toBe('123');
    expect(emitted?.clientName).toBe('Cliente congelado');

    let draft: SaleReturn | undefined;
    api.getById('r10').subscribe((r) => (draft = r));
    httpMock
      .expectOne((r) => r.method === 'GET' && r.url === '/api/billing/sale-returns/r10')
      .flush({ id: 'r10', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv-1', reason: '', lines: [], issuer: null });
    expect(draft?.issuer).toBeNull();
  });
});
