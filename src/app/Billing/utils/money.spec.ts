import { SaleInvoiceLine } from '../models/billing-sale-invoice.model';
import { calcTotals, lineIvaCents, lineSubtotalCents, lineSubtotalOf, mulQtyCents, pctOfCents } from './money';
import { calcReturnTotals, returnLineIvaCents, returnLineSubtotalCents, returnLineSubtotalOf } from './sale-return';

const line = (over: Partial<SaleInvoiceLine> = {}): SaleInvoiceLine => ({
  productId: 'p',
  productName: 'P',
  cantidad: 1,
  precioCatalogoCents: 100,
  precioUnitarioCents: 100,
  ivaCatalogoPct: 19,
  ivaPct: 19,
  ...over,
});

// Aritmética monetaria sin flotantes: debe coincidir con el BigDecimal HALF_UP del back
describe('money (redondeo HALF_UP con enteros)', () => {
  it('1.005 × 100 = 101 (con flotantes daba 100 por 1.005 × 100 = 100.49999...)', () => {
    expect(mulQtyCents(1.005, 100)).toBe(101);
    expect(lineSubtotalCents(line({ cantidad: 1.005, precioUnitarioCents: 100 }))).toBe(101);
  });

  it('otros empates que los flotantes redondean mal', () => {
    expect(mulQtyCents(2.675, 100)).toBe(268); // 267.49999999999994 con flotantes
    expect(mulQtyCents(0.5, 3)).toBe(2); // 1.5 -> 2 (HALF_UP)
    expect(mulQtyCents(1.001, 500)).toBe(501); // 500.5 -> 501
    expect(mulQtyCents(3, 1999)).toBe(5997);
    expect(mulQtyCents(0.001, 100)).toBe(0); // 0.1 -> 0
  });

  it('IVA: base × % / 100 con HALF_UP (como TaxRate.of del back)', () => {
    expect(pctOfCents(5, 10)).toBe(1); // 0.5 -> 1: "0.05 × 10% = 0.005 -> 0.01"
    expect(pctOfCents(101, 19)).toBe(19); // 19.19
    expect(pctOfCents(1000, 5.25)).toBe(53); // 52.5 -> 53
    expect(pctOfCents(1000, 0)).toBe(0);
    expect(pctOfCents(250, 19)).toBe(48); // 47.5 -> 48
  });

  it('subtotal, IVA y total de un borrador', () => {
    const l = line({ cantidad: 1.005, precioUnitarioCents: 100, ivaPct: 19 });
    expect(lineIvaCents(l)).toBe(19);
    expect(calcTotals([l, line({ cantidad: 2, precioUnitarioCents: 250, ivaPct: 5 })])).toEqual({
      subtotalCents: 101 + 500,
      ivaCents: 19 + 25,
      totalCents: 101 + 500 + 19 + 25,
    });
  });

  it('una línea sin dato de IVA (null) suma 0 de IVA en el total provisional', () => {
    expect(lineIvaCents(line({ ivaPct: null }))).toBe(0);
  });

  it('en un documento NO editable manda el subtotal de la línea del back; en borrador, el cálculo local', () => {
    const l = line({ cantidad: 2, precioUnitarioCents: 100, subtotalCents: 999 });
    expect(lineSubtotalOf(l, false)).toBe(999);
    expect(lineSubtotalOf(l, true)).toBe(200); // borrador: el dato del back puede estar viejo tras editar
    expect(lineSubtotalOf(line({ cantidad: 2, precioUnitarioCents: 100 }), false)).toBe(200); // sin dato del back: se calcula
  });
});

describe('sale-return (mismo redondeo que la factura)', () => {
  const rl = (over: Record<string, unknown> = {}) =>
    ({ cantidadDevuelta: 1.005, precioUnitarioCents: 100, ivaPct: 19, ...over }) as Parameters<typeof returnLineSubtotalCents>[0];

  it('1.005 × 100 = 101 y su IVA', () => {
    expect(returnLineSubtotalCents(rl())).toBe(101);
    expect(returnLineIvaCents(rl())).toBe(19);
    expect(calcReturnTotals([rl()])).toEqual({ subtotalCents: 101, ivaCents: 19, totalCents: 120 });
  });

  it('en una devolución no editable manda el subtotal de la línea del back', () => {
    const l = { ...rl(), subtotalCents: 555 };
    expect(returnLineSubtotalOf(l, false)).toBe(555);
    expect(returnLineSubtotalOf(l, true)).toBe(101);
  });
});
