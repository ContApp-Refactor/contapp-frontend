import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { discardPeriodicTasks, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { loadingInterceptor } from './loading.interceptor';
import { LoadingService } from '../Services/loading.service';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });

  afterEach(() => httpMock.verify({ ignoreCancelled: true }));

  it('la petición en vuelo muestra el overlay a los 200 ms y lo libera al responder', fakeAsync(() => {
    let visible: boolean | undefined;
    const sub = loading.visible$.subscribe((v) => (visible = v));

    http.get('/test/exito').subscribe();
    tick(200);
    expect(visible).toBe(true);

    httpMock.expectOne('/test/exito').flush({ ok: true });
    expect(visible).toBe(false);

    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('una petición que responde bajo el umbral nunca muestra el overlay', fakeAsync(() => {
    const seen: boolean[] = [];
    const sub = loading.visible$.subscribe((v) => seen.push(v));

    http.get('/test/rapida').subscribe();
    tick(100);
    httpMock.expectOne('/test/rapida').flush({});
    tick(300);

    expect(seen).not.toContain(true);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('un error HTTP también libera el overlay', fakeAsync(() => {
    let visible: boolean | undefined;
    const sub = loading.visible$.subscribe((v) => (visible = v));

    http.get('/test/error').subscribe({ error: () => {} });
    tick(200);
    expect(visible).toBe(true);

    httpMock
      .expectOne('/test/error')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect(visible).toBe(false);

    sub.unsubscribe();
    discardPeriodicTasks();
  }));

  it('al desuscribirse de la petición se decrementa igual (finalize)', fakeAsync(() => {
    let visible: boolean | undefined;
    const sub = loading.visible$.subscribe((v) => (visible = v));

    const reqSub = http.get('/test/cancel').subscribe();
    tick(200);
    expect(visible).toBe(true);

    reqSub.unsubscribe();
    expect(visible).toBe(false);

    httpMock.expectOne('/test/cancel');
    sub.unsubscribe();
    discardPeriodicTasks();
  }));
});
