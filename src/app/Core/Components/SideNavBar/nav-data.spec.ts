import { navbarData } from './nav-data';

describe('navbarData: Facturación separada', () => {
  const comercial = navbarData.find((g) => g.label === 'Comercial')!;
  const labels = comercial.items!.map((i) => i.label);

  it('el grupo Comercial tiene Compras y Ventas, y ya no "Facturación"', () => {
    expect(labels).toContain('Compras');
    expect(labels).toContain('Ventas');
    expect(labels).not.toContain('Facturación');
  });

  it('cada entrada apunta al hub de su tipo', () => {
    const route = (label: string) => comercial.items!.find((i) => i.label === label)!.routeLink;
    expect(route('Compras')).toBe('/billing/purchase');
    expect(route('Ventas')).toBe('/billing/sale');
  });
});
