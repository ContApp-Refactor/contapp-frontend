import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocalStorageMethods } from '../../Shared/Methods/local-storage.method';
import { SaleInvoice, SaleInvoiceDraftInput } from '../models/billing-sale-invoice.model';
import { BillingHttpSaleInvoiceApi, toDraftBody } from './billing-http-sale-invoice.api';
import { IDEMPOTENCY_HEADER } from './idempotency-key.store';

const URL_SALE = '/api/billing/sale-invoices';

const input = (over: Partial<SaleInvoiceDraftInput> = {}): SaleInvoiceDraftInput => ({
  kind: 'SALE',
  clientId: 'c1',
  date: '2026-10-27',
  lines: [],
  ...over,
});

describe('BillingHttpSaleInvoiceApi (idempotencia)', () => {
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

  const nextPost = () => httpMock.expectOne((r) => r.method === 'POST' && r.url === URL_SALE);

  it('el POST de creación envía el header Idempotency-Key', () => {
    api.saveDraft(input()).subscribe();
    const req = nextPost();
    expect(req.request.headers.get(IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({ id: 'i1' } as SaleInvoice);
  });

  it('el reintento tras un error SIN respuesta (status 0) reutiliza la misma clave', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush(null, { status: 0, statusText: 'red' });

    api.saveDraft(input()).subscribe();
    const retry = nextPost();
    expect(retry.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
    retry.flush({ id: 'i1' } as SaleInvoice);
  });

  it('un error definitivo del back (503 con código) descarta la clave: el reintento usa una nueva', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush({ code: 'BILLING_SEQUENCE_BUSY' }, { status: 503, statusText: 'Service Unavailable' });

    api.saveDraft(input()).subscribe();
    const retry = nextPost();
    expect(retry.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    retry.flush({ id: 'i1' } as SaleInvoice);
  });

  it('un 4xx también descarta la clave', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush({ code: 'BILLING_VALIDATION' }, { status: 400, statusText: 'Bad Request' });

    api.saveDraft(input({ clientId: 'c2' })).subscribe();
    const retry = nextPost();
    expect(retry.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    retry.flush({ id: 'i1' } as SaleInvoice);
  });

  it('dos envíos simultáneos del mismo cuerpo comparten clave', () => {
    api.saveDraft(input()).subscribe();
    api.saveDraft(input()).subscribe();
    const reqs = httpMock.match((r) => r.method === 'POST' && r.url === URL_SALE);
    expect(reqs.length).toBe(2);
    expect(reqs[0].request.headers.get(IDEMPOTENCY_HEADER)).toBe(reqs[1].request.headers.get(IDEMPOTENCY_HEADER));
    reqs.forEach((r) => r.flush({ id: 'i1' } as SaleInvoice));
  });

  it('tras un éxito la siguiente creación usa una clave nueva', () => {
    api.saveDraft(input()).subscribe();
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush({ id: 'i1' } as SaleInvoice);

    api.saveDraft(input()).subscribe();
    const second = nextPost();
    expect(second.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    second.flush({ id: 'i2' } as SaleInvoice);
  });

  it('si el contenido cambió tras un error definitivo, el reintento usa una clave nueva', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush({ code: 'BILLING_VALIDATION', message: 'x' }, { status: 422, statusText: 'Unprocessable' });

    api.saveDraft(input({ clientId: 'c2' })).subscribe();
    const changed = nextPost();
    expect(changed.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    changed.flush({ id: 'i1' } as SaleInvoice);
  });

  it('creación con timeout (sin respuesta) y edición posterior: reenvía el cuerpo ORIGINAL con la MISMA clave y luego PUT con lo nuevo (un solo documento)', () => {
    api.saveDraft(input({ clientId: 'c1' })).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    const originalBody = first.request.body;
    first.error(new ProgressEvent('timeout'), { status: 0, statusText: 'Unknown Error' }); // el back SÍ creó, pero no llegó la respuesta

    let result: SaleInvoice | undefined;
    api.saveDraft(input({ clientId: 'c2' })).subscribe((i) => (result = i));
    const replay = nextPost();
    expect(replay.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key); // misma clave
    expect(replay.request.body).toEqual(originalBody); // cuerpo original (c1), no el nuevo
    replay.flush({ id: 'i1', version: 3 } as SaleInvoice); // el back hace replay: el MISMO documento

    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url === `${URL_SALE}/i1`);
    expect((put.request.body as { clientId: string; version: number }).clientId).toBe('c2'); // lo nuevo
    expect((put.request.body as { version: number }).version).toBe(3); // con la versión del documento creado
    expect(put.request.headers.has(IDEMPOTENCY_HEADER)).toBeFalse();
    put.flush({ id: 'i1', version: 4 } as SaleInvoice);
    expect(result?.id).toBe('i1');
    expect(result?.version).toBe(4);

    // Tras el éxito la clave se libera: la siguiente creación usa una clave nueva
    api.saveDraft(input({ clientId: 'c3' })).subscribe();
    const next = nextPost();
    expect(next.request.headers.get(IDEMPOTENCY_HEADER)).not.toBe(key);
    next.flush({ id: 'i2' } as SaleInvoice);
  });

  it('creación con timeout y reintento del MISMO cuerpo: replay normal, sin PUT', () => {
    api.saveDraft(input()).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.error(new ProgressEvent('timeout'), { status: 0, statusText: 'Unknown Error' });

    api.saveDraft(input()).subscribe();
    const replay = nextPost();
    expect(replay.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key);
    replay.flush({ id: 'i1', version: 1 } as SaleInvoice);
    httpMock.expectNone((r) => r.method === 'PUT'); // verify() también lo comprobaría
  });

  it('si el PUT posterior al replay falla, la clave se conserva: el siguiente guardado reenvía el original y reintenta el PUT', () => {
    api.saveDraft(input({ clientId: 'c1' })).subscribe({ error: () => undefined });
    const first = nextPost();
    const key = first.request.headers.get(IDEMPOTENCY_HEADER);
    first.flush(null, { status: 0, statusText: 'red' });

    api.saveDraft(input({ clientId: 'c2' })).subscribe({ error: () => undefined });
    nextPost().flush({ id: 'i1', version: 1 } as SaleInvoice);
    httpMock.expectOne((r) => r.method === 'PUT').flush(null, { status: 0, statusText: 'red' });

    api.saveDraft(input({ clientId: 'c2' })).subscribe();
    const again = nextPost();
    expect(again.request.headers.get(IDEMPOTENCY_HEADER)).toBe(key); // sigue siendo el mismo documento: no se duplica
    again.flush({ id: 'i1', version: 1 } as SaleInvoice);
    httpMock.expectOne((r) => r.method === 'PUT').flush({ id: 'i1', version: 2 } as SaleInvoice);
  });

  it('precio sin editar viaja null (sigue al catálogo) y el editado viaja como override', () => {
    const line = (productId: string, precioUnitarioCents: number) => ({
      productId,
      productName: productId,
      cantidad: 2,
      precioCatalogoCents: 1000,
      precioUnitarioCents,
      ivaCatalogoPct: 19,
      ivaPct: 19,
    });
    api.saveDraft(input({ id: 'i1', lines: [line('p1', 1000), line('p2', 1500)] })).subscribe();
    const put = httpMock.expectOne((r) => r.method === 'PUT');
    const lines = (put.request.body as { lines: { productId: string; precioUnitarioCents: number | null; ivaPct: number | null }[] }).lines;
    expect(lines[0].precioUnitarioCents).toBeNull(); // sin editar: sigue al catálogo
    expect(lines[1].precioUnitarioCents).toBe(1500); // editado: prevalece
    expect(lines[0].ivaPct).toBeNull(); // IVA igual a la referencia y sin edición: lo resuelve el back
    put.flush({ id: 'i1' } as SaleInvoice);
  });

  it('compra: la línea sin editar viaja null (el back sugiere el último precio de compra) y su respuesta se adopta tal cual', () => {
    let saved: SaleInvoice | undefined;
    api.saveDraft(
      input({
        kind: 'PURCHASE',
        id: 'p1',
        lines: [
          // vista previa = cost (1000); el usuario no tocó el precio
          { productId: 'a', productName: 'a', cantidad: 1, precioCatalogoCents: 1000, precioUnitarioCents: 1000, precioEditado: false, ivaPct: null },
          // override explícito del usuario: manda sobre el último precio
          { productId: 'b', productName: 'b', cantidad: 1, precioCatalogoCents: 1000, precioUnitarioCents: 900, precioEditado: true, ivaPct: null },
        ],
      }),
    ).subscribe((s) => (saved = s));
    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url === '/api/billing/purchase-invoices/p1');
    const lines = (put.request.body as { lines: { precioUnitarioCents: number | null }[] }).lines;
    expect(lines.map((l) => l.precioUnitarioCents)).toEqual([null, 900]);
    put.flush({
      id: 'p1',
      kind: 'PURCHASE',
      lines: [
        { productId: 'a', precioCatalogoCents: 1250, precioUnitarioCents: 1250, precioEditado: false },
        { productId: 'b', precioCatalogoCents: 1250, precioUnitarioCents: 900, precioEditado: true },
      ],
    });
    expect(saved?.lines.map((l) => l.precioCatalogoCents)).toEqual([1250, 1250]);
    expect(saved?.lines.map((l) => l.precioUnitarioCents)).toEqual([1250, 900]);
  });

  describe('precio: misma regla que el IVA (precioEditado)', () => {
    type Body = { lines: { precioUnitarioCents: number | null }[] };
    const priceLine = (over: Record<string, unknown>) => ({
      productId: 'p1', productName: 'p1', cantidad: 1, precioCatalogoCents: 1000, precioUnitarioCents: 1000, ivaPct: null, ...over,
    });
    const sendAndGetBody = (lines: unknown[]): Body => {
      api.saveDraft(input({ id: 'i1', lines: lines as never })).subscribe();
      const put = httpMock.expectOne((r) => r.method === 'PUT');
      const body = put.request.body as Body;
      put.flush({ id: 'i1' } as SaleInvoice);
      return body;
    };

    it('un precio editado IGUAL al catálogo se envía explícito; sin editar viaja null', () => {
      const body = sendAndGetBody([
        priceLine({ precioEditado: true }), // override que casualmente coincide con el catálogo
        priceLine({ precioEditado: false }), // sigue al catálogo
        priceLine({ precioEditado: false, precioUnitarioCents: 1500 }), // la bandera manda sobre el valor viejo
        priceLine({ precioUnitarioCents: 1500 }), // sin bandera y distinto: editado
        priceLine({}), // sin bandera e igual: sin editar
      ]);
      expect(body.lines.map((l) => l.precioUnitarioCents)).toEqual([1000, null, null, 1500, null]);
    });

    it('toDraftBody (usado también al duplicar) respeta precioEditado', () => {
      const body = toDraftBody(input({ lines: [priceLine({ precioEditado: true })] as never }));
      expect(body.lines[0].precioUnitarioCents).toBe(1000);
    });
  });

  describe('IVA: el back es la fuente de verdad', () => {
    type Body = { lines: { ivaPct: number | null }[] };
    const ivaLine = (over: Record<string, unknown>) => ({
      productId: 'p1', productName: 'p1', cantidad: 1, precioUnitarioCents: 100, ivaCatalogoPct: 19, ivaPct: 19, ...over,
    });
    const sendAndGetBody = (lines: unknown[]): Body => {
      api.saveDraft(input({ id: 'i1', lines: lines as never })).subscribe();
      const put = httpMock.expectOne((r) => r.method === 'PUT');
      const body = put.request.body as Body;
      put.flush({ id: 'i1' } as SaleInvoice);
      return body;
    };

    it('sin edición el body envía ivaPct null; con edición envía el valor', () => {
      const body = sendAndGetBody([
        ivaLine({ ivaPct: 19 }), // igual a la referencia, sin bandera
        ivaLine({ ivaPct: 5 }), // difiere de la referencia: editado
        ivaLine({ ivaPct: 5, ivaEditado: false }), // el back dice que sigue al catálogo (la referencia cambió)
      ]);
      expect(body.lines.map((l) => l.ivaPct)).toEqual([null, 5, null]);
    });

    it('un override del usuario que coincide con la referencia NO se pierde si ivaEditado es true', () => {
      const body = sendAndGetBody([ivaLine({ ivaPct: 19, ivaEditado: true })]);
      expect(body.lines[0].ivaPct).toBe(19);
    });

    it('una línea sin dato de IVA (null) nunca envía 0 ni otro valor inventado', () => {
      const body = sendAndGetBody([
        ivaLine({ ivaPct: null, ivaCatalogoPct: null }),
        ivaLine({ ivaPct: null, ivaCatalogoPct: null, ivaEditado: false }),
      ]);
      expect(body.lines.map((l) => l.ivaPct)).toEqual([null, null]);
    });

    it('sin referencias de catálogo ni bandera el IVA se envía tal cual', () => {
      const body = sendAndGetBody([{ productId: 'p1', productName: 'p1', cantidad: 1, precioUnitarioCents: 100, ivaPct: 0 }]);
      expect(body.lines[0].ivaPct).toBe(0);
    });
  });

  it('conserva issuer, clientName y clientDocument congelados y ivaEditado/ivaCatalogoPct de las líneas', () => {
    let result: SaleInvoice | undefined;
    api.getById('i1').subscribe((i) => (result = i));
    detail(`${URL_SALE}/i1`).flush({
      id: 'i1',
      kind: 'SALE',
      status: 'EMITIDA',
      clientName: 'Cliente congelado',
      clientDocument: '123',
      issuer: { enterpriseId: 'e1', name: 'Emisor', nit: '900', dv: '1', active: true },
      lines: [{ productId: 'p1', ivaCatalogoPct: 19, ivaPct: 5, ivaEditado: true }],
    });
    expect(result?.issuer?.name).toBe('Emisor');
    expect(result?.clientDocument).toBe('123');
    expect(result?.lines[0].ivaEditado).toBeTrue();
    expect(result?.lines[0].ivaCatalogoPct).toBe(19);
  });

  it('una línea sin referencias de catálogo envía el precio tal cual', () => {
    api.saveDraft(
      input({ id: 'i1', lines: [{ productId: 'p1', productName: 'p1', cantidad: 1, precioUnitarioCents: 700, ivaPct: 0 }] }),
    ).subscribe();
    const put = httpMock.expectOne((r) => r.method === 'PUT');
    expect((put.request.body as { lines: { precioUnitarioCents: number | null }[] }).lines[0].precioUnitarioCents).toBe(700);
    put.flush({ id: 'i1' } as SaleInvoice);
  });

  it('el PUT, emit y annul no envían la clave', () => {
    api.saveDraft(input({ id: 'i1' })).subscribe();
    const put = httpMock.expectOne((r) => r.method === 'PUT');
    expect(put.request.headers.has(IDEMPOTENCY_HEADER)).toBeFalse();
    put.flush({ id: 'i1' } as SaleInvoice);

    api.emit('i1').subscribe();
    const emit = httpMock.expectOne((r) => r.url.endsWith('/i1/emit'));
    expect(emit.request.headers.has(IDEMPOTENCY_HEADER)).toBeFalse();
    emit.flush({ id: 'i1' } as SaleInvoice);
  });

  // --- bloqueo optimista: la versión viaja en el body (PUT, emit, annul) o por query (DELETE) ---
  it('el PUT envía la versión conocida en el body', () => {
    api.saveDraft(input({ id: 'i1', version: 4 })).subscribe();
    const put = httpMock.expectOne((r) => r.method === 'PUT');
    expect((put.request.body as { version: number | null }).version).toBe(4);
    put.flush({ id: 'i1', version: 5 } as SaleInvoice);

    api.saveDraft(input({ id: 'i1' })).subscribe(); // sin versión conocida: null (el back no verifica)
    const put2 = httpMock.expectOne((r) => r.method === 'PUT');
    expect((put2.request.body as { version: number | null }).version).toBeNull();
    put2.flush({ id: 'i1' } as SaleInvoice);
  });

  it('emit y annul envían la versión en el body y DELETE por query', () => {
    api.getById('i1').subscribe(); // el tipo del documento queda recordado (si no, emit lo prueba antes)
    httpMock.expectOne((r) => r.method === 'GET' && r.url === `${URL_SALE}/i1`).flush({ id: 'i1', kind: 'SALE' });

    api.emit('i1', 7).subscribe();
    const emit = httpMock.expectOne((r) => r.url.endsWith('/i1/emit'));
    expect(emit.request.body).toEqual({ version: 7 });
    emit.flush({ id: 'i1' } as SaleInvoice);

    api.annul('i1', 'motivo', 8).subscribe();
    const annul = httpMock.expectOne((r) => r.url.endsWith('/i1/annul'));
    expect(annul.request.body).toEqual({ reason: 'motivo', version: 8 });
    annul.flush({ id: 'i1' } as SaleInvoice);

    api.deleteDraft('i1', 9).subscribe();
    const del = httpMock.expectOne((r) => r.method === 'DELETE');
    expect(del.request.params.get('version')).toBe('9');
    del.flush(null);

    api.deleteDraft('i1').subscribe();
    const del2 = httpMock.expectOne((r) => r.method === 'DELETE');
    expect(del2.request.params.has('version')).toBeFalse();
    del2.flush(null);
  });

  // --- listado: hidratación tolerante y orden ---
  const flushSummaries = (sale: string[], purchase: string[]) => {
    httpMock.expectOne((r) => r.method === 'GET' && r.url === URL_SALE).flush(sale.map((id) => ({ id })));
    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/billing/purchase-invoices').flush(purchase.map((id) => ({ id })));
  };
  const detail = (url: string) => httpMock.expectOne((r) => r.method === 'GET' && r.url === url);

  it('un documento que falla al hidratar se omite sin tumbar el listado y se ordena por updatedAt descendente', () => {
    spyOn(console, 'warn');
    let result: SaleInvoice[] | undefined;
    api.list().subscribe((list) => (result = list));
    flushSummaries(['s1', 's2'], ['p1']);
    detail(`${URL_SALE}/s1`).flush({ id: 's1', kind: 'SALE', updatedAt: '2026-10-01T10:00:00Z' });
    detail(`${URL_SALE}/s2`).flush(null, { status: 404, statusText: 'Not Found' }); // borrador eliminado entre medio
    detail('/api/billing/purchase-invoices/p1').flush({ id: 'p1', kind: 'PURCHASE', updatedAt: '2026-10-05T10:00:00Z' });
    expect(result?.map((i) => i.id)).toEqual(['p1', 's1']);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('si fallan todos por un error distinto de 404 el listado propaga el error', () => {
    spyOn(console, 'warn');
    let error: unknown;
    api.list().subscribe({ error: (e) => (error = e) });
    flushSummaries(['s1'], []);
    detail(`${URL_SALE}/s1`).flush(null, { status: 500, statusText: 'Server Error' });
    expect((error as { status: number }).status).toBe(500);
  });

  it('si solo hay 404 (todo eliminado) devuelve una lista vacía', () => {
    spyOn(console, 'warn');
    let result: SaleInvoice[] | undefined;
    api.list().subscribe((list) => (result = list));
    flushSummaries(['s1'], []);
    detail(`${URL_SALE}/s1`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(result).toEqual([]);
  });

  it('informa cuántos documentos se omitieron por error (un 404 no cuenta) y los muestra el listado', () => {
    spyOn(console, 'warn');
    let result: { items: SaleInvoice[]; skipped: number } | undefined;
    api.listWithSkipped().subscribe((r) => (result = r));
    flushSummaries(['s1', 's2', 's3'], ['p1']);
    detail(`${URL_SALE}/s1`).flush({ id: 's1', kind: 'SALE', updatedAt: '2026-10-01T10:00:00Z' });
    detail(`${URL_SALE}/s2`).flush(null, { status: 500, statusText: 'Server Error' });
    detail(`${URL_SALE}/s3`).flush(null, { status: 404, statusText: 'Not Found' });
    detail('/api/billing/purchase-invoices/p1').flush(null, { status: 503, statusText: 'Unavailable' });
    expect(result?.items.map((i) => i.id)).toEqual(['s1']);
    expect(result?.skipped).toBe(2); // 500 y 503; el 404 es un borrador eliminado entre medio
  });

  it('si fallan todos propaga un error representativo (el primero que NO es 404), no un 404 arbitrario', () => {
    spyOn(console, 'warn');
    let error: unknown;
    api.listWithSkipped().subscribe({ error: (e) => (error = e) });
    flushSummaries(['s1', 's2'], []);
    detail(`${URL_SALE}/s1`).flush(null, { status: 404, statusText: 'Not Found' });
    detail(`${URL_SALE}/s2`).flush(null, { status: 500, statusText: 'Server Error' });
    expect((error as { status: number }).status).toBe(500);
  });

  it('conserva returnStatus, totals y version que envía el back', () => {
    let result: SaleInvoice | undefined;
    api.getById('i1').subscribe((i) => (result = i));
    detail(`${URL_SALE}/i1`).flush({
      id: 'i1',
      kind: 'SALE',
      returnStatus: 'PARCIAL',
      totals: { subtotalCents: 1, ivaCents: 2, totalCents: 3 },
      version: 2,
    });
    expect(result?.returnStatus).toBe('PARCIAL');
    expect(result?.totals?.totalCents).toBe(3);
    expect(result?.version).toBe(2);
  });
});

describe('toDraftBody: retenciones', () => {
  const base = { kind: 'SALE' as const, clientId: 'c1', date: '2026-11-09', lines: [] };
  it('envía withholdings [{code, taxId}] con el id numérico como número', () => {
    const body = toDraftBody({ ...base, withholdings: [{ code: 'RETE_ICA', taxId: '3' }, { code: 'RETE_IVA', taxId: 4 }] }) as { withholdings: unknown };
    expect(body.withholdings).toEqual([{ code: 'RETE_ICA', taxId: 3 }, { code: 'RETE_IVA', taxId: 4 }]);
  });
  it('un id no numérico viaja como string; [] se envía (quita las retenciones); ausente no se toca', () => {
    expect((toDraftBody({ ...base, withholdings: [{ code: 'RETE_FUENTE', taxId: 'abc' }] }) as { withholdings: unknown }).withholdings).toEqual([{ code: 'RETE_FUENTE', taxId: 'abc' }]);
    expect((toDraftBody({ ...base, withholdings: [] }) as { withholdings: unknown }).withholdings).toEqual([]);
    expect('withholdings' in toDraftBody(base)).toBeFalse();
  });
});
