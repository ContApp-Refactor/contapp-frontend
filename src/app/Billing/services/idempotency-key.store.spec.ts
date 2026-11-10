import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IdempotencyKeyStore, isUnknownOutcome } from './idempotency-key.store';

describe('IdempotencyKeyStore', () => {
  let store: IdempotencyKeyStore;

  beforeEach(() => (store = new IdempotencyKeyStore()));

  it('genera una clave con forma de UUID', () => {
    expect(store.keyFor('invoice:SALE', { a: 1 })).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('reutiliza la clave mientras el ámbito y el cuerpo sean los mismos', () => {
    const first = store.keyFor('invoice:SALE', { a: 1 });
    expect(store.keyFor('invoice:SALE', { a: 1 })).toBe(first);
    expect(store.keyFor('invoice:SALE', { a: 1 })).toBe(first);
  });

  it('renueva la clave cuando el cuerpo cambia (otra intención)', () => {
    const first = store.keyFor('invoice:SALE', { a: 1 });
    expect(store.keyFor('invoice:SALE', { a: 2 })).not.toBe(first);
  });

  it('usa claves distintas por ámbito', () => {
    const sale = store.keyFor('invoice:SALE', { a: 1 });
    expect(store.keyFor('invoice:PURCHASE', { a: 1 })).not.toBe(sale);
  });

  it('release libera la clave: el siguiente intento con el mismo cuerpo usa una nueva', () => {
    const first = store.keyFor('invoice:SALE', { a: 1 });
    store.release('invoice:SALE', first);
    expect(store.keyFor('invoice:SALE', { a: 1 })).not.toBe(first);
  });

  it('release con una clave que ya no es la pendiente no borra la vigente', () => {
    const old = store.keyFor('invoice:SALE', { a: 1 });
    const current = store.keyFor('invoice:SALE', { a: 2 });
    store.release('invoice:SALE', old);
    expect(store.keyFor('invoice:SALE', { a: 2 })).toBe(current);
  });

  describe('resultado desconocido (sin respuesta HTTP)', () => {
    it('tras markUnknown, un cuerpo distinto REENVÍA el original con la misma clave (replay)', () => {
      const first = store.acquire('invoice:SALE', { a: 1 });
      store.markUnknown('invoice:SALE', first.key);
      const next = store.acquire('invoice:SALE', { a: 2 });
      expect(next.key).toBe(first.key);
      expect(next.body).toEqual({ a: 1 }); // el cuerpo ORIGINAL
      expect(next.replay).toBeTrue(); // el nuevo difiere: hay que aplicarlo después con PUT
    });

    it('tras markUnknown, el mismo cuerpo es un replay normal (sin PUT)', () => {
      const first = store.acquire('invoice:SALE', { a: 1 });
      store.markUnknown('invoice:SALE', first.key);
      const next = store.acquire('invoice:SALE', { a: 1 });
      expect(next).toEqual({ key: first.key, body: { a: 1 }, replay: false });
    });

    it('discard (error definitivo): el siguiente intento usa clave nueva, aunque haya estado desconocido', () => {
      const first = store.acquire('invoice:SALE', { a: 1 });
      store.markUnknown('invoice:SALE', first.key);
      store.discard('invoice:SALE', first.key);
      expect(store.acquire('invoice:SALE', { a: 1 }).key).not.toBe(first.key);
    });

    it('forget(scope) olvida el intento pendiente aunque su resultado fuera desconocido', () => {
      const first = store.acquire('return:SALE:inv-1', { a: 1 });
      store.markUnknown('return:SALE:inv-1', first.key);
      store.forget('return:SALE:inv-1');
      expect(store.acquire('return:SALE:inv-1', { a: 1 }).key).not.toBe(first.key);
    });

    it('markUnknown con una clave que ya no es la vigente no afecta a la actual', () => {
      const old = store.acquire('invoice:SALE', { a: 1 });
      const current = store.acquire('invoice:SALE', { a: 2 }); // otra intención, clave nueva
      store.markUnknown('invoice:SALE', old.key);
      expect(store.acquire('invoice:SALE', { a: 3 }).key).not.toBe(current.key);
    });
  });

  describe('isUnknownOutcome', () => {
    const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });
    it('sin respuesta (status 0, timeout, error no HTTP) o 5xx sin cuerpo del back es desconocido', () => {
      expect(isUnknownOutcome(http(0))).toBeTrue();
      expect(isUnknownOutcome(new Error('timeout'))).toBeTrue();
      expect(isUnknownOutcome(http(504, '<html>Gateway Timeout</html>'))).toBeTrue();
    });
    it('un 4xx o un 5xx con el cuerpo de error del back es definitivo', () => {
      expect(isUnknownOutcome(http(409, { code: 'BILLING_IDEMPOTENCY_CONFLICT' }))).toBeFalse();
      expect(isUnknownOutcome(http(400))).toBeFalse();
      expect(isUnknownOutcome(http(503, { code: 'BILLING_SEQUENCE_BUSY' }))).toBeFalse();
    });
  });

  describe('create', () => {
    const dto = (id: string, version = 1) => ({ id, version });

    it('éxito: libera la clave', async () => {
      const send = jasmine.createSpy('send').and.callFake(() => of(dto('d1')));
      await firstValueFrom(store.create('s', { a: 1 }, send, () => of(dto('x'))));
      await firstValueFrom(store.create('s', { a: 1 }, send, () => of(dto('x'))));
      expect(send.calls.argsFor(0)[0]).not.toBe(send.calls.argsFor(1)[0]);
    });

    it('timeout y luego edición: un solo documento (mismo id) y el cuerpo nuevo se aplica con la versión del creado', async () => {
      const sends: { key: string; body: unknown }[] = [];
      let created = false;
      const send = (key: string, body: unknown) => {
        sends.push({ key, body });
        if (!created) {
          created = true; // el back creó el documento, pero la respuesta no llegó
          return throwError(() => new HttpErrorResponse({ status: 0 }));
        }
        return of(dto('d1', 7)); // replay: el mismo documento
      };
      const reconcile = jasmine.createSpy('reconcile').and.callFake((c: { id: string }) => of({ ...c, version: 8 }));

      await expectAsync(firstValueFrom(store.create('s', { a: 1 }, send, reconcile))).toBeRejected();
      const result = await firstValueFrom(store.create('s', { a: 2 }, send, reconcile));

      expect(sends.length).toBe(2);
      expect(sends[1].key).toBe(sends[0].key); // misma clave
      expect(sends[1].body).toEqual({ a: 1 }); // cuerpo original
      expect(reconcile).toHaveBeenCalledOnceWith(dto('d1', 7));
      expect(result.id).toBe('d1');
    });

    it('error definitivo (4xx): la clave se descarta y el siguiente intento usa una nueva', async () => {
      const keys: string[] = [];
      const fail = (key: string) => {
        keys.push(key);
        return throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'X' } }));
      };
      await expectAsync(firstValueFrom(store.create('s', { a: 1 }, fail, () => of(dto('x'))))).toBeRejected();
      await expectAsync(firstValueFrom(store.create('s', { a: 1 }, fail, () => of(dto('x'))))).toBeRejected();
      expect(keys[1]).not.toBe(keys[0]);
    });
  });
});
