import {
  mapSkeletonProductLine,
  mapSkeletonProductsToLineViews,
} from './treasury-purchase-invoice-lines';

describe('treasury-purchase-invoice-lines', () => {
  it('maps skeleton product fields to line view', () => {
    const line = mapSkeletonProductLine({
      productId: 42,
      amount: 2,
      unitPrice: 50000,
      subtotal: 100000,
      discount: 10,
      description: 'Servicio de consultoría',
      taxPercentage: [19],
    });

    expect(line.productLabel).toBe('Servicio de consultoría');
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(50000);
    expect(line.subtotal).toBe(100000);
    expect(line.discountPercent).toBe(10);
    expect(line.discountAmount).toBe(10000);
    expect(line.taxLabel).toBe('19%');
    expect(line.taxAmount).toBe(19000);
    expect(line.lineTotal).toBe(119000);
  });

  it('uses product name map when available', () => {
    const names = new Map<number, string>([[42, 'Licencia anual']]);
    const line = mapSkeletonProductLine({
      productId: 42,
      amount: 1,
      unitPrice: 1000,
      subtotal: 1000,
      discount: 0,
      description: 'fallback',
      taxPercentage: [],
    }, names);

    expect(line.productLabel).toBe('Licencia anual');
    expect(line.description).toBe('fallback');
  });

  it('returns empty array for missing products', () => {
    expect(mapSkeletonProductsToLineViews(null)).toEqual([]);
    expect(mapSkeletonProductsToLineViews([])).toEqual([]);
  });
});
