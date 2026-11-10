import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SaleReturn } from '../models/billing-sale-return.model';
import { BillingSaleReturnApi } from '../services/billing-sale-return.api';
import {
  NOTHING_TO_RETURN_MESSAGE,
  NothingToReturnError,
  ONLY_FRACTION_LEFT_MESSAGE,
  fullReturnLines,
  returnWholeInvoice,
} from './full-return';

const availability = [
  { lineNo: 1, productId: 'a', productName: 'A', sold: 3, returned: 1, available: 2, precioUnitarioCents: 100, ivaPct: 0 },
  { lineNo: 2, productId: 'b', productName: 'B', sold: 1, returned: 0, available: 1, precioUnitarioCents: 100, ivaPct: 0 },
];

const draft = (over: Record<string, unknown> = {}) =>
  ({ id: 'r1', status: 'BORRADOR', version: 3, date: '2026-10-01', reason: '', lines: [], ...over }) as unknown as SaleReturn;

describe('returnWholeInvoice', () => {
  let api: {
    getAvailability: jasmine.Spy;
    listByInvoice: jasmine.Spy;
    saveDraft: jasmine.Spy;
    deleteDraft: jasmine.Spy;
    emit: jasmine.Spy;
    forgetPendingCreation: jasmine.Spy;
  };
  const run = () => returnWholeInvoice(api as unknown as BillingSaleReturnApi, 'inv', 'defecto');

  beforeEach(() => {
    api = {
      getAvailability: jasmine.createSpy('getAvailability').and.returnValue(of(availability)),
      listByInvoice: jasmine.createSpy('listByInvoice').and.returnValue(of([])),
      saveDraft: jasmine.createSpy('saveDraft').and.returnValue(of(draft())),
      deleteDraft: jasmine.createSpy('deleteDraft').and.returnValue(of(undefined)),
      emit: jasmine.createSpy('emit').and.returnValue(of(draft({ status: 'EMITIDA' }))),
      forgetPendingCreation: jasmine.createSpy('forgetPendingCreation'),
    };
  });

  describe('POST de creación sin respuesta (timeout)', () => {
    const timeout = () => throwError(() => new HttpErrorResponse({ status: 0 }));

    it('borra el huérfano y libera la clave de idempotencia (el reintento no hace replay de un documento borrado)', async () => {
      const orphan = draft({ id: 'huerfano', version: 0 });
      api.listByInvoice.and.returnValues(of([]), of([orphan]));
      api.saveDraft.and.returnValue(timeout());
      await expectAsync(run()).toBeRejected();
      expect(api.deleteDraft).toHaveBeenCalledOnceWith('huerfano', 0);
      expect(api.forgetPendingCreation).toHaveBeenCalledOnceWith('inv');
    });

    it('si no se pudo consultar los borradores, NO libera la clave (el replay evita duplicar)', async () => {
      api.listByInvoice.and.returnValues(of([]), throwError(() => new Error('sin red')));
      api.saveDraft.and.returnValue(timeout());
      await expectAsync(run()).toBeRejected();
      expect(api.deleteDraft).not.toHaveBeenCalled();
      expect(api.forgetPendingCreation).not.toHaveBeenCalled();
    });
  });

  describe('borrador de devolución que el usuario tenía a medias', () => {
    const partial = draft({
      id: 'old1',
      version: 8,
      date: '2026-09-30',
      reason: 'motivo a medias',
      lines: [
        { sourceLineNo: 2, productId: 'b', productName: 'B', cantidadDevuelta: 1, precioUnitarioCents: 100, ivaPct: 0 },
      ],
    });

    it('si la emisión falla lo RESTAURA (líneas, motivo y fecha originales, con la versión vigente) y no lo borra', async () => {
      api.listByInvoice.and.returnValue(of([partial]));
      api.saveDraft.and.returnValues(of(draft({ id: 'old1', version: 9 })), of(draft({ id: 'old1', version: 10 })));
      api.emit.and.returnValue(throwError(() => new Error('falló')));
      await expectAsync(run()).toBeRejectedWithError('falló');

      expect(api.saveDraft).toHaveBeenCalledTimes(2);
      const overwrite = api.saveDraft.calls.argsFor(0)[0];
      expect(overwrite.id).toBe('old1');
      expect(overwrite.lines).toEqual([{ lineNo: 1, cantidad: 2 }, { lineNo: 2, cantidad: 1 }]); // la devolución completa
      const restore = api.saveDraft.calls.argsFor(1)[0];
      expect(restore).toEqual({
        id: 'old1',
        version: 9, // la vigente tras sobrescribirlo
        invoiceId: 'inv',
        date: '2026-09-30',
        reason: 'motivo a medias',
        lines: [{ lineNo: 2, cantidad: 1 }],
      });
      expect(api.deleteDraft).not.toHaveBeenCalled(); // no se destruye el trabajo del usuario
    });

    it('si la restauración también falla, se informa el error original de la emisión', async () => {
      api.listByInvoice.and.returnValue(of([partial]));
      api.saveDraft.and.returnValues(of(draft({ id: 'old1', version: 9 })), throwError(() => new Error('409')));
      api.emit.and.returnValue(throwError(() => new Error('falló la emisión')));
      await expectAsync(run()).toBeRejectedWithError('falló la emisión');
      expect(api.deleteDraft).not.toHaveBeenCalled();
    });

    it('si el PUT que lo sobrescribe falla sin respuesta, intenta devolverlo a su contenido original', async () => {
      api.listByInvoice.and.returnValue(of([partial]));
      api.saveDraft.and.returnValues(throwError(() => new HttpErrorResponse({ status: 0 })), of(draft({ id: 'old1' })));
      await expectAsync(run()).toBeRejected();
      expect(api.saveDraft.calls.argsFor(1)[0].version).toBeNull(); // sin verificar versión: pudo haberse aplicado
      expect(api.saveDraft.calls.argsFor(1)[0].reason).toBe('motivo a medias');
      expect(api.emit).not.toHaveBeenCalled();
    });
  });

  describe('cantidades enteras (Inventario) con facturas históricas con decimales', () => {
    const fractional = [
      { lineNo: 1, productId: 'a', productName: 'A', sold: 3.5, returned: 1, available: 2.5, precioUnitarioCents: 100, ivaPct: 0 },
      { lineNo: 2, productId: 'b', productName: 'B', sold: 0.75, returned: 0, available: 0.75, precioUnitarioCents: 100, ivaPct: 0 },
      { lineNo: 3, productId: 'c', productName: 'C', sold: 4, returned: 0, available: 4, precioUnitarioCents: 100, ivaPct: 0 },
    ];

    it('fullReturnLines ofrece la parte entera del disponible y descarta las líneas con menos de una unidad', () => {
      expect(fullReturnLines(fractional)).toEqual([
        { lineNo: 1, cantidad: 2 },
        { lineNo: 3, cantidad: 4 },
      ]);
    });

    it('envía al back solo cantidades enteras', async () => {
      api.getAvailability.and.returnValue(of(fractional));
      await run();
      const sent = api.saveDraft.calls.mostRecent().args[0];
      expect(sent.lines.every((l: { cantidad: number }) => Number.isInteger(l.cantidad))).toBeTrue();
    });

    it('si solo quedan fracciones de unidad, informa que no se puede devolver más (sin crear borrador)', async () => {
      api.getAvailability.and.returnValue(of([{ ...fractional[1] }]));
      await expectAsync(run()).toBeRejectedWith(new NothingToReturnError(ONLY_FRACTION_LEFT_MESSAGE));
      expect(api.saveDraft).not.toHaveBeenCalled();
    });

    it('sin nada disponible mantiene el mensaje de "devuelta por completo"', async () => {
      api.getAvailability.and.returnValue(of(availability.map((a) => ({ ...a, available: 0 }))));
      await expectAsync(run()).toBeRejectedWith(new NothingToReturnError(NOTHING_TO_RETURN_MESSAGE));
    });
  });

  it('si la emisión falla por Inventario (422 BILLING_STOCK_*) propaga ESE error y elimina el borrador creado', async () => {
    const stock = new HttpErrorResponse({ status: 422, error: { code: 'BILLING_STOCK_INSUFFICIENT', message: 'x' } });
    api.emit.and.returnValue(throwError(() => stock));
    await expectAsync(run()).toBeRejectedWith(stock);
    expect(api.deleteDraft).toHaveBeenCalledOnceWith('r1');
  });

  it('un borrador creado por esta operación sí se elimina si falla la emisión', async () => {
    api.emit.and.returnValue(throwError(() => new Error('falló')));
    await expectAsync(run()).toBeRejectedWithError('falló');
    expect(api.deleteDraft).toHaveBeenCalledOnceWith('r1');
    expect(api.saveDraft).toHaveBeenCalledTimes(1); // nada que restaurar
  });
});

describe('fullReturnLines con desglose de impuestos', () => {
  it('el desglose de la línea original no viaja en el cuerpo: solo lineNo y cantidad (el back lo hereda)', () => {
    const withTaxes = availability.map((a) => ({ ...a, ivaPct: 25, taxes: [{ name: 'Iva', rate: 19 }, { name: 'Ica', rate: 6 }] }));
    expect(fullReturnLines(withTaxes)).toEqual([
      { lineNo: 1, cantidad: 2 },
      { lineNo: 2, cantidad: 1 },
    ]);
  });
});
