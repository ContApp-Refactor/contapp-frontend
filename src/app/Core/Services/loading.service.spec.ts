import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { LoadingService } from './loading.service';

/**
 * Contrato observable del overlay global (advisory R3-2 del review RDD):
 * umbral de 200 ms, ocultado inmediato al llegar a 0, conteo nunca negativo
 * y poda TTL de 30 s (fail-open + memoria acotada).
 */
describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('no muestra el overlay en peticiones que terminan antes del umbral de 200 ms', fakeAsync(() => {
    const seen: boolean[] = [];
    const sub = service.visible$.subscribe((v) => seen.push(v));

    const id = service.requestStarted();
    tick(100);
    service.requestFinished(id);
    tick(300);

    expect(seen).not.toContain(true);
    expect(seen[seen.length - 1]).toBe(false);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('muestra el overlay a los 200 ms si la petición sigue en vuelo y lo oculta al terminar', fakeAsync(() => {
    let visible: boolean | undefined;
    const sub = service.visible$.subscribe((v) => (visible = v));

    const id = service.requestStarted();
    tick(199);
    expect(visible).toBe(false);
    tick(1);
    expect(visible).toBe(true);

    service.requestFinished(id);
    expect(visible).toBe(false);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('se oculta recién cuando terminan todas las peticiones concurrentes', fakeAsync(() => {
    let visible: boolean | undefined;
    const sub = service.visible$.subscribe((v) => (visible = v));

    const id1 = service.requestStarted();
    const id2 = service.requestStarted();
    tick(200);
    expect(visible).toBe(true);

    service.requestFinished(id1);
    expect(visible).toBe(true);

    service.requestFinished(id2);
    expect(visible).toBe(false);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('un finish duplicado o de un id desconocido no deja el contador negativo', fakeAsync(() => {
    expect(() => service.requestFinished(999)).not.toThrow();

    let visible: boolean | undefined;
    const sub = service.visible$.subscribe((v) => (visible = v));
    const id = service.requestStarted();
    tick(200);
    expect(visible).toBe(true);

    service.requestFinished(id);
    service.requestFinished(id);
    expect(visible).toBe(false);

    tick(500);
    expect(visible).toBe(false);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('podna la petición colgada a los 30 s: falla abierto y libera el registro', fakeAsync(() => {
    // El reloj se controla DENTRO de fakeAsync: zone.js parchea Date.now al
    // entrar al sandbox, así que el spy debe instalarse después.
    let now = 1_700_000_000_000;
    spyOn(Date, 'now').and.callFake(() => now);

    let visible: boolean | undefined;
    const sub = service.visible$.subscribe((v) => (visible = v));

    const id = service.requestStarted();
    tick(200);
    expect(visible).toBe(true);

    // Dentro del tope: el overlay sigue indicando actividad.
    now += 29_999;
    tick(1_000);
    expect(visible).toBe(true);

    // Pasó el tope (30 s): el overlay se retira aunque la petición siga en vuelo
    // y la entrada se poda del mapa (memoria acotada).
    now += 2_001;
    tick(1_000);
    expect(visible).toBe(false);
    const starts = (
      service as unknown as { starts: Map<number, number> }
    ).starts;
    expect(starts.size).toBe(0);

    // El finish tardío de la petición colgada es inocuo.
    expect(() => service.requestFinished(id)).not.toThrow();
    expect(visible).toBe(false);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));
});
