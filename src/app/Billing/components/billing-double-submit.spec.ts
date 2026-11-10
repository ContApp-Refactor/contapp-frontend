import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { SaleInvoice } from '../models/billing-sale-invoice.model';
import { SaleReturn } from '../models/billing-sale-return.model';
import { BillingCounterpartyCatalog } from '../services/billing-counterparty-catalog';
import { BillingProductCatalog } from '../services/billing-product-catalog';
import { BillingPaymentCatalog } from '../services/billing-payment-catalog';
import { BillingTaxCatalog } from '../services/billing-tax-catalog';
import { BillingSaleInvoiceApi } from '../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../services/billing-sale-return.api';
import { SaleInvoiceFormComponent } from './sale-invoice-form/sale-invoice-form.component';
import { SaleInvoiceListComponent } from './sale-invoice-list/sale-invoice-list.component';
import { SaleInvoicePendingComponent } from './sale-invoice-pending/sale-invoice-pending.component';
import { SaleReturnFormComponent } from './sale-return-form/sale-return-form.component';

// N llamadas rápidas (sin esperar a que termine la anterior) deben producir UNA sola petición
const CLICKS = 20;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

const providersFor = (invoiceApi: unknown, returnApi: unknown) => [
  { provide: BillingSaleInvoiceApi, useValue: invoiceApi },
  { provide: BillingSaleReturnApi, useValue: returnApi },
  { provide: BillingProductCatalog, useValue: { getProducts: () => of([]) } },
  { provide: BillingPaymentCatalog, useValue: { getPaymentMethods: () => of([]) } },
  { provide: BillingTaxCatalog, useValue: { getTaxes: () => of([]) } },
  { provide: BillingCounterpartyCatalog, useValue: { getCounterparties: () => of([]) } },
  { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
  { provide: Location, useValue: { replaceState: () => undefined, back: () => undefined } },
  { provide: MessageService, useValue: { add: jasmine.createSpy('add') } },
  { provide: ActivatedRoute, useValue: { snapshot: { data: {}, paramMap: convertToParamMap({}) } } },
];

describe('Doble envío en el formulario de factura', () => {
  let invoiceApi: { saveDraft: jasmine.Spy; emit: jasmine.Spy; deleteDraft: jasmine.Spy; getById: jasmine.Spy };
  let component: SaleInvoiceFormComponent;
  let saveGate: Subject<SaleInvoice>;
  let emitGate: Subject<SaleInvoice>;
  let messages: { add: jasmine.Spy };

  const draft = { id: 'i1', kind: 'SALE', status: 'BORRADOR', number: null, lines: [], date: '2026-10-27', clientId: 'c1' } as unknown as SaleInvoice;

  beforeEach(() => {
    saveGate = new Subject<SaleInvoice>();
    emitGate = new Subject<SaleInvoice>();
    invoiceApi = {
      saveDraft: jasmine.createSpy('saveDraft').and.returnValue(saveGate),
      emit: jasmine.createSpy('emit').and.returnValue(emitGate),
      deleteDraft: jasmine.createSpy('deleteDraft').and.returnValue(of(undefined)),
      getById: jasmine.createSpy('getById').and.returnValue(of(draft)),
    };
    TestBed.configureTestingModule({ providers: providersFor(invoiceApi, {}) });
    TestBed.overrideComponent(SaleInvoiceFormComponent, {
      set: { template: '', templateUrl: undefined, imports: [] },
    });
    component = TestBed.createComponent(SaleInvoiceFormComponent).componentInstance;
    messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    component.clientId.set('c1');
  });

  it('20 llamadas a saveDraft generan una sola petición', async () => {
    for (let i = 0; i < CLICKS; i++) void component.saveDraft();
    await flush();
    expect(invoiceApi.saveDraft).toHaveBeenCalledTimes(1);
    expect(component.busy()).toBeTrue();

    saveGate.next(draft);
    await flush();
    expect(invoiceApi.saveDraft).toHaveBeenCalledTimes(1);
    expect(component.busy()).toBeFalse(); // se libera al terminar
  });

  it('20 llamadas a emit generan un solo guardado y una sola emisión', async () => {
    component.invoiceId.set('i1');
    invoiceApi.saveDraft.and.returnValue(of(draft));
    const emit = (component as unknown as { emit: () => Promise<void> }).emit.bind(component);
    for (let i = 0; i < CLICKS; i++) void emit();
    await flush();
    expect(invoiceApi.emit).toHaveBeenCalledTimes(1);

    emitGate.next({ ...draft, status: 'EMITIDA', number: 'FV-1' });
    await flush();
    expect(invoiceApi.emit).toHaveBeenCalledTimes(1);
    expect(invoiceApi.saveDraft.calls.count()).toBeLessThanOrEqual(1);
  });

  it('un 409 BILLING_IDEMPOTENCY_CONFLICT muestra el mensaje de error', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    void component.saveDraft();
    await flush();
    saveGate.error(
      new HttpErrorResponse({ status: 409, error: { code: 'BILLING_IDEMPOTENCY_CONFLICT', message: 'x' } }),
    );
    await flush();
    const call = messages.add.calls.mostRecent().args[0];
    expect(call.severity).toBe('error');
    expect(call.detail).toContain('datos distintos');
    expect(component.busy()).toBeFalse();
  });

  // --- bloqueo optimista (A2): cada PUT usa la versión de la respuesta anterior y emit también la envía ---
  it('envía la versión de la respuesta anterior en cada guardado y en la emisión', async () => {
    component.invoiceId.set('i1');
    invoiceApi.saveDraft.and.returnValues(of({ ...draft, version: 4 }), of({ ...draft, version: 5 }));
    await component.saveDraft();
    expect(invoiceApi.saveDraft.calls.mostRecent().args[0].version).toBeNull(); // aún no conocía ninguna
    await component.saveDraft();
    expect(invoiceApi.saveDraft.calls.mostRecent().args[0].version).toBe(4);

    invoiceApi.emit.and.returnValue(of({ ...draft, status: 'EMITIDA', number: 'FV-1', version: 6 }));
    const emit = (component as unknown as { emit: () => Promise<void> }).emit.bind(component);
    await emit();
    expect(invoiceApi.emit).toHaveBeenCalledOnceWith('i1', 5);
  });

  it('eliminar envía la versión vigente', async () => {
    component.invoiceId.set('i1');
    invoiceApi.saveDraft.and.returnValue(of({ ...draft, version: 7 }));
    await component.saveDraft();
    await (component as unknown as { deleteDraft: () => Promise<void> }).deleteDraft();
    expect(invoiceApi.deleteDraft).toHaveBeenCalledOnceWith('i1', 7);
  });

  it('un 409 BILLING_CONCURRENT_MODIFICATION muestra el mensaje claro y recarga el documento', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    component.invoiceId.set('i1');
    invoiceApi.saveDraft.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'BILLING_CONCURRENT_MODIFICATION', message: 'x' } })),
    );
    await component.saveDraft();
    const call = messages.add.calls.mostRecent().args[0];
    expect(call.severity).toBe('error');
    expect(call.detail).toBe(
      'El documento fue modificado por otra persona o en otra pestaña. Recarga para ver la versión actual.',
    );
    expect(invoiceApi.getById).toHaveBeenCalledOnceWith('i1');
  });

  // --- A1/R2: cantidad > 0 y aviso del autosave ---
  it('una cantidad vacía o ≤ 0 vuelve al último valor válido (0 rompería el autosave con el back)', () => {
    component.lines.set([
      { productId: 'p', productName: 'P', cantidad: 3, precioCatalogoCents: 100, precioUnitarioCents: 100, ivaCatalogoPct: 0, ivaPct: 0 },
    ]);
    component.setQuantity(0, 0);
    expect(component.lines()[0].cantidad).toBe(3); // no queda en 0 ni salta al mínimo
    component.setQuantity(0, null);
    expect(component.lines()[0].cantidad).toBe(3);
    component.setQuantity(0, -4);
    expect(component.lines()[0].cantidad).toBe(3);
    component.setQuantity(0, 0.0004); // menos de una unidad
    expect(component.lines()[0].cantidad).toBe(3);
    component.setQuantity(0, 2.5); // Inventario solo admite enteros: se toma la parte entera
    expect(component.lines()[0].cantidad).toBe(2);
    component.setQuantity(0, 1.23456);
    expect(component.lines()[0].cantidad).toBe(1);
  });

  // Antes: "admite vender menos de una unidad: el mínimo es 0.001". Hoy Inventario solo admite cantidades enteras.
  it('NO admite vender menos de una unidad: el mínimo es 1 y las cantidades son enteras', () => {
    component.lines.set([
      { productId: 'p', productName: 'P', cantidad: 3, precioCatalogoCents: 100, precioUnitarioCents: 100, ivaCatalogoPct: 0, ivaPct: 0 },
    ]);
    component.setQuantity(0, 0.5);
    expect(component.lines()[0].cantidad).toBe(3); // vuelve al último válido
    component.setQuantity(0, 0.001);
    expect(component.lines()[0].cantidad).toBe(3);
    component.setQuantity(0, 1);
    expect(component.lines()[0].cantidad).toBe(1);
    component.setQuantity(0, 1.999);
    expect(component.lines()[0].cantidad).toBe(1);
  });

  it('un borrador histórico con decimales se muestra tal cual pero no se puede emitir hasta corregirlo', () => {
    component.lines.set([
      { productId: 'p', productName: 'P', cantidad: 2.5, precioCatalogoCents: 100, precioUnitarioCents: 100, ivaCatalogoPct: 0, ivaPct: 0 },
    ]);
    expect(component.qtyFractionDigits(2.5)).toBe(3); // no se muestra redondeado a "3"
    expect(component.qtyFractionDigits(2)).toBe(0);
    component.paymentMethods.set([{ id: '7', name: 'Efectivo' }]);
    component.paymentMethodId.set('7');
    component.confirmEmit();
    const call = messages.add.calls.mostRecent().args[0];
    expect(call.severity).toBe('warn');
    expect(call.detail).toContain('cantidades enteras');
    expect(invoiceApi.emit).not.toHaveBeenCalled();
  });

  it('revertir una cantidad inválida no marca el documento como sucio (no dispara guardado)', () => {
    component.lines.set([
      { productId: 'p', productName: 'P', cantidad: 3, precioCatalogoCents: 100, precioUnitarioCents: 100, ivaCatalogoPct: 0, ivaPct: 0 },
    ]);
    component.setQuantity(0, 0);
    expect(component.saveState()).toBe('idle');
    component.setQuantity(0, 4);
    expect(component.saveState()).toBe('pending');
  });

  // --- IVA: el back es la fuente de verdad ---
  const ivaLine = (over: Record<string, unknown> = {}) => ({
    productId: 'p', productName: 'P', cantidad: 1, precioCatalogoCents: 100, precioUnitarioCents: 100,
    ivaCatalogoPct: null, ivaPct: null, ivaEditado: false, ...over,
  });

  it('tras guardar, una línea sin edición toma ivaPct/ivaCatalogoPct de la respuesta del back', async () => {
    component.invoiceId.set('i1');
    component.lines.set([ivaLine()] as never);
    invoiceApi.saveDraft.and.returnValue(
      of({ ...draft, lines: [ivaLine({ lineNo: 1, ivaCatalogoPct: 5, ivaPct: 5 })] }),
    );
    await component.saveDraft();
    expect(component.lines()[0].ivaPct).toBe(5);
    expect(component.lines()[0].ivaCatalogoPct).toBe(5);
    expect(component.lines()[0].lineNo).toBe(1);
  });

  it('si el usuario siguió editando durante el guardado no se pisa su línea con la respuesta', async () => {
    component.invoiceId.set('i1');
    component.lines.set([ivaLine()] as never);
    void component.saveDraft();
    await flush();
    component.setIva(0, 7); // edita mientras el guardado sigue en curso
    saveGate.next({ ...draft, lines: [ivaLine({ ivaCatalogoPct: 19, ivaPct: 19 })] } as never);
    await flush();
    expect(component.lines()[0].ivaPct).toBe(7);
    expect(component.lines()[0].ivaEditado).toBeTrue();
  });

  it('editar el IVA marca ivaEditado; vaciar el campo devuelve la línea a la referencia del catálogo', () => {
    component.lines.set([ivaLine({ ivaCatalogoPct: 19, ivaPct: 19 })] as never);
    component.setIva(0, 19); // coincide con la referencia pero es una decisión del usuario
    expect(component.lines()[0].ivaPct).toBe(19);
    expect(component.lines()[0].ivaEditado).toBeTrue();
    component.setIva(0, 5);
    expect(component.lines()[0].ivaPct).toBe(5);
    component.setIva(0, null);
    expect(component.lines()[0].ivaPct).toBe(19);
    expect(component.lines()[0].ivaEditado).toBeFalse();
  });

  it('una línea nueva sin dato de IVA queda en null (no se inventa 0)', () => {
    component.products.set([{ id: 'p', code: 'P', name: 'P', priceCents: 100, ivaPct: null }]);
    component.selectedProductId = 'p';
    component.addProduct();
    expect(component.lines()[0].ivaPct).toBeNull();
    expect(component.lines()[0].ivaCatalogoPct).toBeNull();
    expect(component.lines()[0].ivaEditado).toBeFalse();
  });

  // --- precio: vaciar el campo vuelve al catálogo (igual que el IVA), no a $0 ---
  it('vaciar el precio vuelve al valor del catálogo (precioEditado=false), nunca a $0', () => {
    component.lines.set([
      { ...ivaLine(), precioCatalogoCents: 1000, precioUnitarioCents: 1500, precioEditado: true },
    ] as never);
    component.setUnitPrice(0, null);
    expect(component.lines()[0].precioUnitarioCents).toBe(1000);
    expect(component.lines()[0].precioEditado).toBeFalse();
    component.setUnitPrice(0, 12.5); // en pesos
    expect(component.lines()[0].precioUnitarioCents).toBe(1250);
    expect(component.lines()[0].precioEditado).toBeTrue();
    component.setUnitPrice(0, 10); // igual al catálogo pero decisión del usuario: queda editado
    expect(component.lines()[0].precioUnitarioCents).toBe(1000);
    expect(component.lines()[0].precioEditado).toBeTrue();
  });

  it('una línea nueva sigue al catálogo: precioEditado=false', () => {
    component.products.set([{ id: 'p', code: 'P', name: 'P', priceCents: 700, ivaPct: 19 }]);
    component.selectedProductId = 'p';
    component.addProduct();
    expect(component.lines()[0].precioEditado).toBeFalse();
  });

  it('durante el tecleo un valor intermedio inválido no se aplica ni se revierte; al salir se normaliza', () => {
    component.lines.set([ivaLine({ cantidad: 3, ivaCatalogoPct: 19, ivaPct: 5, ivaEditado: true })] as never);
    component.onQuantityInput(0, 0); // "0" camino a "0,5" / "05"
    component.onQuantityInput(0, null); // campo vacío
    component.onQuantityInput(0, 0.5); // fracción: Inventario solo admite enteros, no se aplica
    expect(component.lines()[0].cantidad).toBe(3);
    expect(component.saveState()).toBe('idle'); // no se marcó sucio
    component.onQuantityInput(0, 5);
    expect(component.lines()[0].cantidad).toBe(5);

    component.onIvaInput(0, null); // vacío intermedio: se ignora hasta salir del campo
    expect(component.lines()[0].ivaPct).toBe(5);
    component.onIvaInput(0, 7);
    expect(component.lines()[0].ivaPct).toBe(7);
  });

  // --- adoptSavedLine: también precios sin editar ---
  const priceLine = (over: Record<string, unknown> = {}) => ({
    ...ivaLine({ ivaCatalogoPct: 19, ivaPct: 19 }), precioCatalogoCents: 1000, precioUnitarioCents: 1000, precioEditado: false, ...over,
  });

  it('tras guardar, una línea sin editar adopta precioUnitarioCents y precioCatalogoCents del back', async () => {
    component.invoiceId.set('i1');
    component.lines.set([priceLine()] as never);
    invoiceApi.saveDraft.and.returnValue(
      of({ ...draft, lines: [priceLine({ lineNo: 1, precioCatalogoCents: 1200, precioUnitarioCents: 1200 })] }),
    );
    await component.saveDraft();
    expect(component.lines()[0].precioCatalogoCents).toBe(1200);
    expect(component.lines()[0].precioUnitarioCents).toBe(1200);
  });

  it('un precio editado por el usuario no se pisa con la respuesta (solo se actualiza la referencia)', async () => {
    component.invoiceId.set('i1');
    component.lines.set([priceLine({ precioUnitarioCents: 1500, precioEditado: true })] as never);
    invoiceApi.saveDraft.and.returnValue(
      of({ ...draft, lines: [priceLine({ lineNo: 1, precioCatalogoCents: 1200, precioUnitarioCents: 1500, precioEditado: true })] }),
    );
    await component.saveDraft();
    expect(component.lines()[0].precioUnitarioCents).toBe(1500);
    expect(component.lines()[0].precioCatalogoCents).toBe(1200);
    expect(component.lines()[0].precioEditado).toBeTrue();
  });

  it('si el usuario volvió a editar durante el guardado no se adoptan los precios de la respuesta', async () => {
    component.invoiceId.set('i1');
    component.lines.set([priceLine()] as never);
    void component.saveDraft();
    await flush();
    component.setUnitPrice(0, 20); // edita mientras el guardado sigue en curso
    saveGate.next({ ...draft, lines: [priceLine({ precioCatalogoCents: 1200, precioUnitarioCents: 1200 })] } as never);
    await flush();
    expect(component.lines()[0].precioUnitarioCents).toBe(2000);
    expect(component.lines()[0].precioEditado).toBeTrue();
  });

  // --- refreshDraft: una respuesta GET vieja no pisa una escritura posterior ---
  describe('refreshDraft', () => {
    const internals = () =>
      component as unknown as { refreshDraft: () => void; applyInvoice: (i: SaleInvoice) => void; version: number | null };
    let getGate: Subject<SaleInvoice>;

    beforeEach(() => {
      getGate = new Subject<SaleInvoice>();
      component.invoiceId.set('i1');
    });

    it('descarta la respuesta si hubo una escritura (emitir) mientras el GET estaba en vuelo, aunque no haya versión', async () => {
      internals().applyInvoice(draft);
      invoiceApi.getById.and.returnValue(getGate);
      internals().refreshDraft(); // el GET sale con el documento aún en BORRADOR
      spyOn(component as unknown as { loadReturns: () => void }, 'loadReturns');
      invoiceApi.emit.and.returnValue(of({ ...draft, status: 'EMITIDA', number: 'FV-1' }));
      await (component as unknown as { emit: () => Promise<void> }).emit();
      expect(component.status()).toBe('EMITIDA');

      getGate.next({ ...draft }); // respuesta vieja: BORRADOR
      expect(component.status()).toBe('EMITIDA'); // no vuelve a mostrar BORRADOR
      expect(component.number()).toBe('FV-1');
    });

    it('descarta la respuesta si hubo un guardado mientras el GET estaba en vuelo', async () => {
      internals().applyInvoice({ ...draft, version: 3 });
      invoiceApi.getById.and.returnValue(getGate);
      internals().refreshDraft();
      component.onClientChange('c9');
      invoiceApi.saveDraft.and.returnValue(of({ ...draft, clientId: 'c9', version: 4 }));
      await component.saveDraft();
      expect(internals().version).toBe(4);

      getGate.next({ ...draft, clientId: 'c1', version: 3 }); // vieja: la versión retrocedería
      expect(component.clientId()).toBe('c9');
      expect(internals().version).toBe(4);
    });

    it('descarta una respuesta con versión menor a la conocida aunque no haya escrituras', () => {
      internals().applyInvoice({ ...draft, version: 5 });
      invoiceApi.getById.and.returnValue(getGate);
      internals().refreshDraft();
      getGate.next({ ...draft, clientId: 'viejo', version: 2 });
      expect(component.clientId()).toBe('c1');
      expect(internals().version).toBe(5);
    });

    it('aplica una respuesta vigente (misma o mayor versión, sin escrituras)', () => {
      internals().applyInvoice({ ...draft, version: 5 });
      invoiceApi.getById.and.returnValue(getGate);
      internals().refreshDraft();
      getGate.next({ ...draft, clientId: 'c7', version: 6 });
      expect(component.clientId()).toBe('c7');
      expect(internals().version).toBe(6);
    });
  });

  // --- A3: datos congelados en documentos emitidos ---
  it('en un documento emitido el tercero sale congelado aunque el catálogo haya cambiado', () => {
    component.clients.set([{ id: 'c1', name: 'Nombre Nuevo SAS', document: '999', category: 'Cliente' }]);
    (component as unknown as { applyInvoice: (i: SaleInvoice) => void }).applyInvoice({
      ...draft, status: 'EMITIDA', number: 'FV-1', clientName: 'Nombre Viejo', clientDocument: '123',
      issuer: { enterpriseId: 'e1', name: 'Emisor Congelado', nit: '900', dv: '1', active: true },
    } as SaleInvoice);
    expect(component.clientName()).toBe('Nombre Viejo');
    expect(component.clientDocument()).toBe('123');
    expect(component.previewClient()?.name).toBe('Nombre Viejo');
    expect(component.previewClient()?.document).toBe('123');
    expect(component.issuer()?.name).toBe('Emisor Congelado');
  });

  it('en un borrador el tercero sigue siendo el del catálogo vivo', () => {
    component.clients.set([{ id: 'c1', name: 'Nombre Nuevo SAS', document: '999', category: 'Cliente' }]);
    (component as unknown as { applyInvoice: (i: SaleInvoice) => void }).applyInvoice({
      ...draft, clientName: 'Nombre Viejo', clientDocument: '123',
    } as SaleInvoice);
    expect(component.clientName()).toBe('Nombre Nuevo SAS');
    expect(component.previewClient()?.document).toBe('999');
    expect(component.clientDocument()).toBeNull();
  });

  it('un autosave fallido avisa UNA sola vez por racha de fallos', async () => {
    component.ngOnInit();
    invoiceApi.saveDraft.and.returnValue(throwError(() => new Error('sin red')));
    component.onClientChange('c1');
    await new Promise((r) => setTimeout(r, 850));
    component.onClientChange('c2');
    await new Promise((r) => setTimeout(r, 850));
    expect(invoiceApi.saveDraft).toHaveBeenCalledTimes(2);
    expect(messages.add).toHaveBeenCalledTimes(1);
    expect(messages.add.calls.mostRecent().args[0].severity).toBe('error');
    expect(component.saveState()).toBe('error');

    // tras un guardado exitoso la racha termina: el siguiente fallo vuelve a avisar
    invoiceApi.saveDraft.and.returnValue(of(draft));
    component.onClientChange('c3');
    await new Promise((r) => setTimeout(r, 850));
    invoiceApi.saveDraft.and.returnValue(throwError(() => new Error('sin red')));
    component.onClientChange('c4');
    await new Promise((r) => setTimeout(r, 850));
    expect(messages.add).toHaveBeenCalledTimes(2);
  });

  it('el guardado de ngOnDestroy que falla muestra un aviso', async () => {
    invoiceApi.saveDraft.and.returnValue(throwError(() => new Error('sin red')));
    component.onClientChange('c1');
    component.ngOnDestroy();
    await flush();
    expect(messages.add.calls.mostRecent().args[0].summary).toContain('al salir');
  });

  // --- R4: no tocar la URL si el componente ya se destruyó ---
  it('tras crear el borrador cambia la URL, salvo que el componente ya se haya destruido', async () => {
    const location = TestBed.inject(Location);
    const replaceState = spyOn(location, 'replaceState');
    invoiceApi.saveDraft.and.returnValue(of({ ...draft, id: 'nuevo' }));
    await component.saveDraft();
    expect(replaceState).toHaveBeenCalledTimes(1);

    // Componente nuevo, destruido con un guardado pendiente que crea el borrador
    const other = TestBed.createComponent(SaleInvoiceFormComponent).componentInstance;
    other.onClientChange('c1');
    other.ngOnDestroy();
    await flush();
    expect(invoiceApi.saveDraft).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenCalledTimes(1); // el guardado de ngOnDestroy no tocó la URL
  });

  // --- R5: eliminar espera el guardado en curso ---
  it('eliminar espera el guardado que crea el borrador y borra el id definitivo', async () => {
    // Autosave en vuelo (no marca `busy`): crea el borrador, aún sin id
    void (component as unknown as { persist: (f: boolean) => Promise<unknown> }).persist(true);
    await flush();
    const deleting = (component as unknown as { deleteDraft: () => Promise<void> }).deleteDraft();
    await flush();
    expect(invoiceApi.deleteDraft).not.toHaveBeenCalled();
    saveGate.next({ ...draft, id: 'creado' });
    await deleting;
    expect(invoiceApi.deleteDraft).toHaveBeenCalledOnceWith('creado', null);
  });

  // --- Inventario: si falla al emitir, el back revierte y el documento sigue en BORRADOR sin número ---
  describe('error de Inventario al emitir (BILLING_STOCK_*)', () => {
    const stockError = async (status: number, code: string, message = 'x') => {
      const { HttpErrorResponse } = await import('@angular/common/http');
      return new HttpErrorResponse({ status, error: { code, message } });
    };
    const emit = () => (component as unknown as { emit: () => Promise<void> }).emit();

    beforeEach(() => {
      (component as unknown as { applyInvoice: (i: SaleInvoice) => void }).applyInvoice({ ...draft, version: 2 });
      invoiceApi.saveDraft.and.returnValue(of({ ...draft, version: 2 }));
    });

    it('422: NO marca la factura como emitida, muestra el mensaje y permite reintentar', async () => {
      const err = await stockError(422, 'BILLING_STOCK_INSUFFICIENT');
      invoiceApi.emit.and.returnValue(throwError(() => err));
      await emit();

      expect(component.status()).toBe('BORRADOR');
      expect(component.number()).toBeNull();
      expect(component.editable()).toBeTrue();
      expect(component.busy()).toBeFalse(); // el botón "Emitir" vuelve a estar habilitado
      const call = messages.add.calls.mostRecent().args[0];
      expect(call.severity).toBe('error');
      expect(call.summary).toBe('No se pudo emitir');
      expect(call.detail).toContain('No hay existencias suficientes en Inventario');
      expect(invoiceApi.getById).not.toHaveBeenCalled(); // 422: la respuesta es definitiva, no hace falta recargar

      // Reintento (p. ej. tras registrar la entrada de mercancía): ahora sí se emite
      invoiceApi.emit.and.returnValue(of({ ...draft, status: 'EMITIDA', number: 'FV-9', version: 3 }));
      spyOn(component as unknown as { loadReturns: () => void }, 'loadReturns');
      await emit();
      expect(invoiceApi.emit).toHaveBeenCalledTimes(2);
      expect(component.status()).toBe('EMITIDA');
      expect(component.number()).toBe('FV-9');
    });

    it('REJECTED muestra el detalle del back', async () => {
      const err = await stockError(422, 'BILLING_STOCK_REJECTED', 'La fecha 2026-10-27 está fuera del calendario contable.');
      invoiceApi.emit.and.returnValue(throwError(() => err));
      await emit();
      expect(messages.add.calls.mostRecent().args[0].detail).toBe(
        'Inventario rechazó el movimiento. Detalle: La fecha 2026-10-27 está fuera del calendario contable.',
      );
      expect(component.status()).toBe('BORRADOR');
    });

    it('503 BILLING_STOCK_UNAVAILABLE: avisa, recarga el estado real (sigue en borrador) y permite reintentar', async () => {
      const err = await stockError(503, 'BILLING_STOCK_UNAVAILABLE');
      invoiceApi.emit.and.returnValue(throwError(() => err));
      invoiceApi.getById.and.returnValue(of({ ...draft, version: 2 }));
      await emit();
      expect(messages.add.calls.mostRecent().args[0].detail).toContain('Inventario no está disponible');
      expect(invoiceApi.getById).toHaveBeenCalledOnceWith('i1');
      expect(component.status()).toBe('BORRADOR');
      expect(component.busy()).toBeFalse();
    });
  });
});

describe('Doble envío en el formulario de devolución', () => {
  let returnApi: { saveDraft: jasmine.Spy; emit: jasmine.Spy; annul: jasmine.Spy; deleteDraft: jasmine.Spy };
  let component: SaleReturnFormComponent;
  let gate: Subject<SaleReturn>;

  const saved = { id: 'r1', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv', lines: [], reason: 'x', date: '2026-10-27' } as unknown as SaleReturn;

  beforeEach(() => {
    gate = new Subject<SaleReturn>();
    returnApi = {
      saveDraft: jasmine.createSpy('saveDraft').and.returnValue(of(saved)),
      emit: jasmine.createSpy('emit').and.returnValue(gate),
      annul: jasmine.createSpy('annul').and.returnValue(gate),
      deleteDraft: jasmine.createSpy('deleteDraft').and.returnValue(of(undefined)),
    };
    TestBed.configureTestingModule({ providers: providersFor({}, returnApi) });
    TestBed.overrideComponent(SaleReturnFormComponent, {
      set: { template: '', templateUrl: undefined, imports: [] },
    });
    component = TestBed.createComponent(SaleReturnFormComponent).componentInstance;
    component.returnId.set('r1');
    component.reason.set('defecto');
  });

  it('20 llamadas a emit generan una sola emisión', async () => {
    const emit = (component as unknown as { emit: () => Promise<void> }).emit.bind(component);
    for (let i = 0; i < CLICKS; i++) void emit();
    await flush();
    expect(returnApi.emit).toHaveBeenCalledTimes(1);
    gate.next({ ...saved, status: 'EMITIDA' });
    await flush();
    expect(returnApi.emit).toHaveBeenCalledTimes(1);
  });

  it('guarda con la versión de la respuesta anterior y la envía al emitir y al eliminar', async () => {
    returnApi.saveDraft.and.returnValue(of({ ...saved, version: 2 }));
    await (component as unknown as { persist: (f: boolean) => Promise<unknown> }).persist(true);
    await (component as unknown as { persist: (f: boolean) => Promise<unknown> }).persist(true);
    expect(returnApi.saveDraft.calls.argsFor(0)[0].version).toBeNull();
    expect(returnApi.saveDraft.calls.argsFor(1)[0].version).toBe(2);

    await (component as unknown as { deleteDraft: () => Promise<void> }).deleteDraft();
    expect(returnApi.deleteDraft).toHaveBeenCalledOnceWith('r1', 2);

    const emit = (component as unknown as { emit: () => Promise<void> }).emit.bind(component);
    void emit();
    await flush();
    expect(returnApi.emit).toHaveBeenCalledOnceWith('r1', 2);
  });

  it('eliminar espera el guardado en curso antes de leer el id', async () => {
    component.returnId.set(null);
    const create = new Subject<SaleReturn>();
    returnApi.saveDraft.and.returnValue(create);
    const persist = (component as unknown as { persist: (f: boolean) => Promise<unknown> }).persist.bind(component);
    void persist(true);
    await flush();
    const deleting = (component as unknown as { deleteDraft: () => Promise<void> }).deleteDraft();
    await flush();
    expect(returnApi.deleteDraft).not.toHaveBeenCalled();
    create.next({ ...saved, id: 'creada' });
    await deleting;
    expect(returnApi.deleteDraft).toHaveBeenCalledOnceWith('creada', null);
  });

  it('el guardado de ngOnDestroy no cambia la URL tras destruirse el componente', async () => {
    const location = TestBed.inject(Location);
    const replaceState = spyOn(location, 'replaceState');
    component.returnId.set(null);
    component.onReasonChange('motivo');
    component.ngOnDestroy();
    await flush();
    expect(returnApi.saveDraft).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();
  });

  // Una devolución no se anula: el formulario ya no expone la anulación (el endpoint sigue en el back)
  it('el formulario de devolución ya no ofrece anular', () => {
    expect((component as unknown as Record<string, unknown>)['confirmAnnul']).toBeUndefined();
    expect((component as unknown as Record<string, unknown>)['openAnnul']).toBeUndefined();
    expect(returnApi.annul).not.toHaveBeenCalled();
  });

  it('"Devolver todo" llena cada casilla con lo disponible y deja ajustar a mano', () => {
    component.status.set('BORRADOR');
    component.rows.set([
      { lineNo: 1, productId: 'a', productName: 'A', sold: 5, returned: 1, available: 4, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
      { lineNo: 2, productId: 'b', productName: 'B', sold: 2, returned: 2, available: 0, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
    ]);
    expect(component.canReturnAll()).toBeTrue();
    component.returnAll();
    // En pantalla la línea sin disponible queda en 0, pero NO se envía: el back exige cantidad > 0 (ReturnLineRequest @Positive)
    expect(component.rows().map((r) => r.cantidadDevuelta)).toEqual([4, 0]);
    expect(component.canReturnAll()).toBeFalse();
    component.setQuantity(0, 1); // si no se quiere todo, se edita la casilla
    expect(component.rows()[0].cantidadDevuelta).toBe(1);
    expect(component.canReturnAll()).toBeTrue();
  });

  it('al guardar envía por lineNo solo las líneas con cantidad mayor a cero', async () => {
    component.returnId.set(null);
    component.rows.set([
      { lineNo: 1, productId: 'a', productName: 'A', sold: 5, returned: 1, available: 4, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
      { lineNo: 2, productId: 'b', productName: 'B', sold: 2, returned: 2, available: 0, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
      { lineNo: 3, productId: 'c', productName: 'C', sold: 3, returned: 0, available: 3, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
    ]);
    component.returnAll(); // a: 4, b: 0 (sin disponible), c: 3
    await (component as unknown as { persist: (f: boolean) => Promise<unknown> }).persist(true);
    const sent = returnApi.saveDraft.calls.mostRecent().args[0];
    expect(sent.lines).toEqual([
      { lineNo: 1, cantidad: 4 },
      { lineNo: 3, cantidad: 3 },
    ]);
  });

  // Antes: "acepta cantidades decimales (hasta 3) sin exigir enteros". Hoy Inventario solo admite enteros; la factura
  // histórica con decimales (disponible 2.5) sigue mostrándose y se puede devolver hasta su parte entera (2).
  it('solo admite cantidades enteras: toma la parte entera y limita a la parte entera de lo disponible', () => {
    component.status.set('BORRADOR');
    component.rows.set([
      { lineNo: 1, productId: 'a', productName: 'A', sold: 2.5, returned: 0, available: 2.5, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
    ]);
    component.setQuantity(0, 1.25);
    expect(component.rows()[0].cantidadDevuelta).toBe(1);
    component.setQuantity(0, 9);
    expect(component.rows()[0].cantidadDevuelta).toBe(2); // se limita a la parte entera de lo disponible
    expect(component.maxReturnable(component.rows()[0])).toBe(2);
  });

  it('"Devolver todo" en una factura histórica con decimales ofrece la parte entera de lo disponible', () => {
    component.status.set('BORRADOR');
    component.rows.set([
      { lineNo: 1, productId: 'a', productName: 'A', sold: 2.5, returned: 0, available: 2.5, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
      { lineNo: 2, productId: 'b', productName: 'B', sold: 0.5, returned: 0, available: 0.5, cantidadDevuelta: 0, precioUnitarioCents: 100, ivaPct: 0 },
    ]);
    expect(component.canReturnAll()).toBeTrue();
    component.returnAll();
    expect(component.rows().map((r) => r.cantidadDevuelta)).toEqual([2, 0]);
    expect(component.canReturnAll()).toBeFalse(); // la fracción restante (0.5 y 0.5) no se puede devolver
  });

  it('no permite emitir una cantidad con decimales (borrador histórico)', () => {
    component.status.set('BORRADOR');
    component.rows.set([
      { lineNo: 1, productId: 'a', productName: 'A', sold: 3, returned: 0, available: 3, cantidadDevuelta: 1.5, precioUnitarioCents: 100, ivaPct: 0 },
    ]);
    component.confirmEmit();
    const messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    expect(messages.add.calls.mostRecent().args[0].detail).toContain('cantidades enteras');
    expect(returnApi.emit).not.toHaveBeenCalled();
  });

  it('una devolución emitida sin "vendido" del back muestra null (la plantilla pinta "—")', () => {
    const applyReturn = (component as unknown as { applyReturn: (r: SaleReturn) => void }).applyReturn.bind(component);
    applyReturn({
      ...saved,
      status: 'EMITIDA',
      lines: [{ productId: 'a', productName: 'A', cantidadDevuelta: 1, precioUnitarioCents: 100, ivaPct: 0 }],
    } as SaleReturn);
    expect(component.rows()[0].sold).toBeNull();
  });

  it('error de Inventario al emitir (422 ORIGINAL_NOT_FOUND): sigue en borrador, avisa y permite reintentar', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    const err = new HttpErrorResponse({ status: 422, error: { code: 'BILLING_STOCK_ORIGINAL_NOT_FOUND', message: 'x' } });
    returnApi.emit.and.returnValue(throwError(() => err));
    const emit = (component as unknown as { emit: () => Promise<void> }).emit.bind(component);
    await emit();

    expect(component.status()).toBe('BORRADOR');
    expect(component.number()).toBeNull();
    expect(component.busy()).toBeFalse();
    const messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    const call = messages.add.calls.mostRecent().args[0];
    expect(call.summary).toBe('No se pudo emitir');
    expect(call.detail).toContain('movimiento de la factura original');

    returnApi.emit.and.returnValue(of({ ...saved, status: 'EMITIDA', number: 'NC-2' }));
    await emit();
    expect(returnApi.emit).toHaveBeenCalledTimes(2);
    expect(component.status()).toBe('EMITIDA');
  });
});

describe('Devolver factura completa (reemplaza a anular)', () => {
  let returnApi: {
    getAvailability: jasmine.Spy;
    saveDraft: jasmine.Spy;
    emit: jasmine.Spy;
    deleteDraft: jasmine.Spy;
    listByInvoice: jasmine.Spy;
    annul: jasmine.Spy;
  };
  let component: SaleInvoiceFormComponent;
  let emitGate: Subject<SaleReturn>;
  let messages: { add: jasmine.Spy };

  const availability = [
    { lineNo: 1, productId: 'a', productName: 'A', sold: 3, returned: 1, available: 2, precioUnitarioCents: 100, ivaPct: 0 },
    { lineNo: 2, productId: 'b', productName: 'B', sold: 1, returned: 1, available: 0, precioUnitarioCents: 100, ivaPct: 0 },
  ];
  const draft = { id: 'r1', kind: 'SALE', status: 'BORRADOR', invoiceId: 'inv', version: 3 } as unknown as SaleReturn;

  beforeEach(() => {
    emitGate = new Subject<SaleReturn>();
    returnApi = {
      getAvailability: jasmine.createSpy('getAvailability').and.returnValue(of(availability)),
      saveDraft: jasmine.createSpy('saveDraft').and.returnValue(of(draft)),
      emit: jasmine.createSpy('emit').and.returnValue(emitGate),
      deleteDraft: jasmine.createSpy('deleteDraft').and.returnValue(of(undefined)),
      listByInvoice: jasmine.createSpy('listByInvoice').and.returnValue(of([])),
      annul: jasmine.createSpy('annul'),
    };
    TestBed.configureTestingModule({ providers: providersFor({}, returnApi) });
    TestBed.overrideComponent(SaleInvoiceFormComponent, {
      set: { template: '', templateUrl: undefined, imports: [] },
    });
    component = TestBed.createComponent(SaleInvoiceFormComponent).componentInstance;
    messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    component.invoiceId.set('inv');
    component.status.set('EMITIDA');
  });

  it('exige el motivo antes de devolver', async () => {
    component.fullReturnReason = '  ';
    await component.confirmFullReturn();
    expect(returnApi.saveDraft).not.toHaveBeenCalled();
    expect(messages.add.calls.mostRecent().args[0].severity).toBe('warn');
  });

  it('crea y emite una devolución por todo lo disponible, con el motivo, sin llamar a annul', async () => {
    component.fullReturnReason = ' producto defectuoso ';
    const done = component.confirmFullReturn();
    await flush();
    emitGate.next({ ...draft, status: 'EMITIDA', number: 'NC-1' } as SaleReturn);
    await done;

    expect(returnApi.saveDraft).toHaveBeenCalledTimes(1);
    const sent = returnApi.saveDraft.calls.mostRecent().args[0];
    expect(sent.invoiceId).toBe('inv');
    expect(sent.reason).toBe('producto defectuoso');
    expect(sent.lines).toEqual([{ lineNo: 1, cantidad: 2 }]); // solo lo disponible, por lineNo
    expect(sent.id).toBeUndefined(); // no había borrador previo: se crea
    expect(returnApi.emit).toHaveBeenCalledOnceWith('r1', 3); // con la versión del borrador recién guardado
    expect(returnApi.annul).not.toHaveBeenCalled();
    expect(component.fullReturning()).toBeFalse();
  });

  it('20 llamadas a confirmFullReturn generan una sola devolución', async () => {
    component.fullReturnReason = 'motivo';
    for (let i = 0; i < CLICKS; i++) void component.confirmFullReturn();
    await flush();
    expect(returnApi.saveDraft).toHaveBeenCalledTimes(1);
    expect(component.fullReturning()).toBeTrue();
    emitGate.next({ ...draft, status: 'EMITIDA', number: 'NC-1' } as SaleReturn);
    await flush();
    expect(returnApi.emit).toHaveBeenCalledTimes(1);
    expect(component.fullReturning()).toBeFalse();
  });

  it('si no queda nada disponible muestra un mensaje claro y no crea la devolución', async () => {
    returnApi.getAvailability.and.returnValue(of(availability.map((a) => ({ ...a, available: 0 }))));
    component.fullReturnReason = 'motivo';
    await component.confirmFullReturn();
    expect(returnApi.saveDraft).not.toHaveBeenCalled();
    const call = messages.add.calls.mostRecent().args[0];
    expect(call.severity).toBe('warn');
    expect(call.detail).toContain('devuelta por completo');
  });

  it('si falla la emisión elimina el borrador creado', async () => {
    returnApi.emit.and.returnValue(throwError(() => new Error('falló')));
    component.fullReturnReason = 'motivo';
    await component.confirmFullReturn();
    expect(returnApi.deleteDraft).toHaveBeenCalledOnceWith('r1');
    expect(messages.add.calls.mostRecent().args[0].severity).toBe('error');
    // El servidor pudo emitir aunque falló la respuesta: se recargan devoluciones (util + recarga) y disponibilidad
    expect(returnApi.listByInvoice).toHaveBeenCalledTimes(2);
    expect(returnApi.getAvailability).toHaveBeenCalledTimes(2);
  });

  it('si ya existe un borrador de devolución lo reutiliza (con su versión) y elimina los sobrantes', async () => {
    const existing = { id: 'old1', status: 'BORRADOR', version: 8 } as unknown as SaleReturn;
    const extra = { id: 'old2', status: 'BORRADOR', version: 1 } as unknown as SaleReturn;
    const emitted = { id: 'e1', status: 'EMITIDA' } as unknown as SaleReturn;
    returnApi.listByInvoice.and.returnValue(of([emitted, existing, extra]));
    component.fullReturnReason = 'motivo';
    const done = component.confirmFullReturn();
    await flush();
    emitGate.next({ ...draft, status: 'EMITIDA', number: 'NC-1' } as SaleReturn);
    await done;

    expect(returnApi.deleteDraft).toHaveBeenCalledOnceWith('old2', 1);
    const sent = returnApi.saveDraft.calls.mostRecent().args[0];
    expect(sent.id).toBe('old1');
    expect(sent.version).toBe(8);
  });

  it('si el POST de creación falla sin respuesta, elimina el borrador que el servidor haya creado', async () => {
    const orphan = { id: 'huerfano', status: 'BORRADOR', version: 0 } as unknown as SaleReturn;
    returnApi.listByInvoice.and.returnValues(of([]), of([orphan]), of([orphan]));
    returnApi.saveDraft.and.returnValue(throwError(() => new Error('timeout')));
    component.fullReturnReason = 'motivo';
    await component.confirmFullReturn();
    expect(returnApi.emit).not.toHaveBeenCalled();
    expect(returnApi.deleteDraft).toHaveBeenCalledOnceWith('huerfano', 0);
    expect(messages.add.calls.mostRecent().args[0].severity).toBe('error');
  });

  it('cuando no queda nada disponible también recarga las devoluciones y la disponibilidad', async () => {
    returnApi.getAvailability.and.returnValue(of(availability.map((a) => ({ ...a, available: 0 }))));
    component.fullReturnReason = 'motivo';
    await component.confirmFullReturn();
    expect(returnApi.listByInvoice).toHaveBeenCalledTimes(1);
    expect(returnApi.getAvailability).toHaveBeenCalledTimes(2);
  });

  it('si Inventario rechaza la emisión: informa que no se emitió, descarta el borrador y deja reintentar', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    const err = new HttpErrorResponse({ status: 422, error: { code: 'BILLING_STOCK_INSUFFICIENT', message: 'x' } });
    returnApi.emit.and.returnValue(throwError(() => err));
    component.openFullReturn();
    component.fullReturnReason = 'motivo';
    await component.confirmFullReturn();

    const call = messages.add.calls.mostRecent().args[0];
    expect(call.severity).toBe('error');
    expect(call.detail).toContain('No hay existencias suficientes en Inventario');
    expect(call.detail).toContain('No se emitió ninguna devolución');
    expect(returnApi.deleteDraft).toHaveBeenCalledOnceWith('r1'); // no queda un borrador oculto
    expect(component.fullReturnVisible()).toBeTrue(); // el diálogo sigue abierto con el motivo
    expect(component.fullReturning()).toBeFalse(); // botón habilitado para reintentar
    expect(component.status()).toBe('EMITIDA'); // la factura no cambia
    expect(returnApi.listByInvoice).toHaveBeenCalledTimes(2); // recarga la tabla y la disponibilidad reales
  });

  it('con una factura histórica que solo tiene fracciones disponibles no ofrece "Devolución"', () => {
    returnApi.getAvailability.and.returnValue(of([{ ...availability[0], sold: 2.5, returned: 2, available: 0.5 }]));
    (component as unknown as { loadReturns: (id: string, s: string) => void }).loadReturns('inv', 'EMITIDA');
    expect(component.canReturn()).toBeFalse();
    returnApi.getAvailability.and.returnValue(of([{ ...availability[0], sold: 3.5, returned: 1, available: 2.5 }]));
    (component as unknown as { loadReturns: (id: string, s: string) => void }).loadReturns('inv', 'EMITIDA');
    expect(component.canReturn()).toBeTrue();
  });

  it('si falla la consulta de disponibilidad avisa y marca el estado (no oculta botones sin explicación)', () => {
    returnApi.getAvailability.and.returnValue(throwError(() => new Error('sin red')));
    (component as unknown as { loadReturns: (id: string, s: string) => void }).loadReturns('inv', 'EMITIDA');
    expect(component.availabilityFailed()).toBeTrue();
    expect(messages.add.calls.mostRecent().args[0].severity).toBe('warn');
    expect(component.canReturn()).toBeFalse();
  });
});

// --- listados: toast de omitidos y recarga ante "nada que devolver" ---
describe('Listados de facturas: documentos omitidos y NothingToReturnError', () => {
  const invoice = (id: string) =>
    ({ id, number: 'FV-1', status: 'EMITIDA', kind: 'SALE', clientId: 'c1', clientName: 'C', date: '2026-10-01', lines: [], createdAt: '', updatedAt: '' }) as unknown as SaleInvoice;
  let invoiceApi: { list: jasmine.Spy; listWithSkipped: jasmine.Spy };
  let messages: { add: jasmine.Spy };

  const setup = (api: typeof invoiceApi, returnApi: unknown = {}) => {
    TestBed.configureTestingModule({ providers: providersFor(api, returnApi) });
  };

  beforeEach(() => {
    invoiceApi = {
      list: jasmine.createSpy('list'),
      listWithSkipped: jasmine.createSpy('listWithSkipped').and.returnValue(of({ items: [invoice('i1')], skipped: 3 })),
    };
  });

  it('el listado muestra un toast resumido con la cantidad de documentos que no se pudieron cargar', () => {
    setup(invoiceApi);
    TestBed.overrideComponent(SaleInvoiceListComponent, { set: { template: '', templateUrl: undefined, imports: [] } });
    messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    const list = TestBed.createComponent(SaleInvoiceListComponent).componentInstance;
    list.ngOnInit();
    expect(list.invoices().length).toBe(1);
    const toast = messages.add.calls.mostRecent().args[0];
    expect(toast.severity).toBe('warn');
    expect(toast.detail).toBe('3 documentos no se pudieron cargar.');
  });

  it('sin omitidos no hay toast', () => {
    invoiceApi.listWithSkipped.and.returnValue(of({ items: [invoice('i1')], skipped: 0 }));
    setup(invoiceApi);
    TestBed.overrideComponent(SaleInvoiceListComponent, { set: { template: '', templateUrl: undefined, imports: [] } });
    messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    TestBed.createComponent(SaleInvoiceListComponent).componentInstance.ngOnInit();
    expect(messages.add).not.toHaveBeenCalled();
  });

  it('pendientes: toast resumido de los borradores omitidos', () => {
    setup(invoiceApi);
    TestBed.overrideComponent(SaleInvoicePendingComponent, { set: { template: '', templateUrl: undefined, imports: [] } });
    messages = TestBed.inject(MessageService) as unknown as { add: jasmine.Spy };
    const pending = TestBed.createComponent(SaleInvoicePendingComponent).componentInstance;
    pending.ngOnInit();
    expect(invoiceApi.listWithSkipped).toHaveBeenCalledWith('BORRADOR');
    expect(pending.drafts().length).toBe(1);
    expect(messages.add.calls.mostRecent().args[0].detail).toBe('3 documentos no se pudieron cargar.');
  });

  it('ante NothingToReturnError el listado se recarga (como ya hace el formulario)', async () => {
    const returnApi = {
      getAvailability: jasmine
        .createSpy('getAvailability')
        .and.returnValue(of([{ lineNo: 1, productId: 'a', productName: 'A', sold: 1, returned: 1, available: 0, precioUnitarioCents: 1, ivaPct: 0 }])),
      listByInvoice: jasmine.createSpy('listByInvoice').and.returnValue(of([])),
    };
    setup(invoiceApi, returnApi);
    TestBed.overrideComponent(SaleInvoiceListComponent, { set: { template: '', templateUrl: undefined, imports: [] } });
    const list = TestBed.createComponent(SaleInvoiceListComponent).componentInstance;
    list.ngOnInit();
    expect(invoiceApi.listWithSkipped).toHaveBeenCalledTimes(1);
    list.openReturn(invoice('i1'));
    list.returnReason = 'motivo';
    await list.confirmReturn();
    expect(invoiceApi.listWithSkipped).toHaveBeenCalledTimes(2); // recargó
    expect(list.returnTarget()).toBeNull(); // cerró el diálogo
  });
});
