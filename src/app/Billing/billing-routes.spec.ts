import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { BILLING_ROUTES, kindRoutes } from '../routes/billing.routes';

const paths = (routes: Route[]) => routes.map((r) => r.path);

describe('Rutas de Facturación: hubs separados por tipo', () => {
  const wrapper = BILLING_ROUTES[0].children!;

  it('purchase y sale son hubs con hijos; las estáticas van antes que ":id"', () => {
    for (const kind of ['PURCHASE', 'SALE'] as const) {
      const p = paths(kindRoutes(kind));
      expect(p).toEqual(['', 'pending', 'list', 'returns', 'new', ':invoiceId/return/new', ':id']);
      expect(p.indexOf(':id')).toBe(p.length - 1);
    }
    expect(paths(wrapper)).toContain('purchase');
    expect(paths(wrapper)).toContain('sale');
    expect(wrapper.find((r) => r.path === 'sale')!.data!['kind']).toBe('SALE');
    expect(wrapper.find((r) => r.path === 'purchase')!.data!['kind']).toBe('PURCHASE');
  });

  it('todos los hijos de un hub llevan el kind de su tipo', () => {
    for (const kind of ['PURCHASE', 'SALE'] as const) {
      expect(kindRoutes(kind).every((r) => r.data!['kind'] === kind)).toBeTrue();
    }
  });

  it('"return/:id" sigue existiendo para ambos tipos', () => {
    expect(paths(wrapper)).toContain('return/:id');
  });

  describe('redirects de las rutas viejas', () => {
    let router: Router;
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'billing', children: BILLING_ROUTES }])] });
      router = TestBed.inject(Router);
    });

    const cases: [string, string][] = [
      ['/billing', '/billing/sale'],
      ['/billing/pending', '/billing/sale/pending'],
      ['/billing/list', '/billing/sale/list'],
      ['/billing/returns', '/billing/sale/returns'],
    ];
    for (const [from, to] of cases) {
      it(`${from} -> ${to}`, async () => {
        await router.navigateByUrl(from);
        expect(router.url).toBe(to);
      });
    }

    it('"list" no choca con ":id" en ninguno de los dos tipos', async () => {
      for (const kind of ['purchase', 'sale']) {
        await router.navigateByUrl(`/billing/${kind}/list`);
        expect(router.url).toBe(`/billing/${kind}/list`);
        let leaf = router.routerState.snapshot.root;
        while (leaf.firstChild) leaf = leaf.firstChild;
        expect(leaf.routeConfig!.path).toBe('list');
      }
    });
  });
});
