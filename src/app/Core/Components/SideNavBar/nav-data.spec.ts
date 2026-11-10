import { navbarData } from './nav-data';

describe('navbarData: Facturación separada', () => {
  const comercial = navbarData.find((g) => g.label === 'Comercial')!;
  const labels = comercial.items!.map((i) => i.label);

  it('el grupo Comercial tiene Factura de Compra y Factura de Venta, y ya no "Facturación"', () => {
    expect(labels).toContain('Factura de Compra');
    expect(labels).toContain('Factura de Venta');
    expect(labels).not.toContain('Facturación');
  });

  it('cada entrada apunta al hub de su tipo', () => {
    const route = (label: string) => comercial.items!.find((i) => i.label === label)!.routeLink;
    expect(route('Factura de Compra')).toBe('/billing/purchase');
    expect(route('Factura de Venta')).toBe('/billing/sale');
  });
});
