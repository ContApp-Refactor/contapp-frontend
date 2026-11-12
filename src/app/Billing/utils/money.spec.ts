import { SaleInvoiceLine } from '../models/billing-sale-invoice.model';
import {
  MIN_QUANTITY,
  calcTotals,
  isWholeQty,
  lineIvaCents,
  lineSubtotalCents,
  lineSubtotalOf,
  mulQtyCents,
  pctOfCents,
  taxSummaryRows,
  wholeQty,
  invoiceTotals,
  withholdingAmountCents,
  withholdingRowName,
  withholdingRowsOf,
  withTotalsNet,
} from './money';
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

// Detalle de impuestos: base = suma de subtotales de las líneas que tienen ese impuesto; total = base × tarifa
describe('taxSummaryRows (detalle de impuestos)', () => {
  const ica = { name: 'Ica', rate: 6 };
  const iva19 = { name: 'Iva', rate: 19 };
  const iva12 = { name: 'Iva', rate: 12 };

  it('agrupa por impuesto y cada base suma solo las líneas que lo tienen', () => {
    const rows = taxSummaryRows(
      [
        line({ precioUnitarioCents: 150000, ivaPct: 25, taxes: [iva19, ica] }),
        line({ cantidad: 3, precioUnitarioCents: 200000, ivaPct: 18, taxes: [iva12, ica] }),
      ],
      true,
    );
    expect(rows).toEqual([
      { name: 'Iva 19%', baseCents: 150000, taxCents: 28500 },
      { name: 'Ica 6%', baseCents: 750000, taxCents: 45000 },
      { name: 'Iva 12%', baseCents: 600000, taxCents: 72000 },
    ]);
  });

  it('sin redondear: no pierde fracciones de centavo', () => {
    const [row] = taxSummaryRows([line({ precioUnitarioCents: 333, ivaPct: 19, taxes: [iva19] })], true);
    expect(row.taxCents).toBeCloseTo(63.27, 10);
  });

  it('sin desglose usa una fila única "Iva" con el ivaPct; sin impuestos no aporta filas', () => {
    expect(taxSummaryRows([line({ precioUnitarioCents: 1000, ivaPct: 19 })], true)).toEqual([
      { name: 'Iva 19%', baseCents: 1000, taxCents: 190 },
    ]);
    expect(taxSummaryRows([line({ ivaPct: 0 }), line({ ivaPct: null })], true)).toEqual([]);
  });

  it('en un documento no editable la base usa el subtotal del back', () => {
    const [row] = taxSummaryRows([line({ precioUnitarioCents: 100, subtotalCents: 500, taxes: [iva19] })], false);
    expect(row.baseCents).toBe(500);
  });
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

// Las cantidades nuevas son enteras (Inventario); los cálculos con decimales de arriba siguen cubriendo documentos históricos
describe('cantidades enteras (Inventario)', () => {
  it('el mínimo es 1', () => {
    expect(MIN_QUANTITY).toBe(1);
  });

  it('isWholeQty tolera errores de flotante pero rechaza decimales reales', () => {
    expect(isWholeQty(3)).toBeTrue();
    expect(isWholeQty(0.1 + 0.2 + 2.7)).toBeTrue(); // 3.0000000000000004
    expect(isWholeQty(2.5)).toBeFalse();
    expect(isWholeQty(1.001)).toBeFalse();
  });

  it('wholeQty toma la parte entera hacia abajo (nunca supera el valor)', () => {
    expect(wholeQty(2.5)).toBe(2);
    expect(wholeQty(0.75)).toBe(0);
    expect(wholeQty(4)).toBe(4);
    expect(wholeQty(2.9999999)).toBe(3); // ruido de flotante, no un decimal real
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

describe('retenciones', () => {
  it('monto = subtotal × tasa / 100 con HALF_UP, sobre el subtotal completo', () => {
    expect(withholdingAmountCents(2000000, 20)).toBe(400000);
    expect(withholdingAmountCents(2000000, 10)).toBe(200000);
    expect(withholdingAmountCents(1000, 5.25)).toBe(53); // 52.5 -> 53
    expect(withholdingAmountCents(100000, 0.966)).toBe(970); // tasa a 2 decimales como TaxRate del back (0.97)
    expect(withholdingAmountCents(1000, 0)).toBe(0);
  });

  it('total neto = subtotal + impuestos − retenciones (ejemplo 17.000)', () => {
    const base = { subtotalCents: 2000000, ivaCents: 300000, totalCents: 2300000 };
    expect(withTotalsNet(base, [{ amountCents: 400000 }, { amountCents: 200000 }])).toEqual({
      subtotalCents: 2000000, ivaCents: 300000, withholdingsCents: 600000, totalCents: 1700000,
    });
    expect(withTotalsNet(base, [])).toBe(base);
  });

  it('nombre de la fila y filas desde el response', () => {
    const [row] = withholdingRowsOf([{ code: 'RETE_IVA', taxId: '1', taxName: 'Impuesto del gobierno', ratePct: 5, amountCents: 100 }]);
    expect(withholdingRowName(row)).toBe('ReteIVA');
    expect(withholdingRowsOf(undefined)).toEqual([]);
  });

  it('invoiceTotals: borrador con retenciones resta; emitida usa los del back; sin retenciones no cambia', () => {
    const lines = [line({ precioUnitarioCents: 1000, ivaPct: 10 })];
    const wh = [{ code: 'RETE_ICA' as const, taxId: '3', taxName: 'ICA', ratePct: 20, amountCents: 200 }];
    expect(invoiceTotals({ status: 'BORRADOR', lines, totals: null, withholdings: wh })).toEqual({
      subtotalCents: 1000, ivaCents: 100, withholdingsCents: 200, totalCents: 900,
    });
    const server = { subtotalCents: 1000, ivaCents: 100, withholdingsCents: 200, totalCents: 900 };
    expect(invoiceTotals({ status: 'EMITIDA', lines, totals: server, withholdings: wh })).toBe(server);
    expect(invoiceTotals({ status: 'BORRADOR', lines, totals: null })).toEqual({ subtotalCents: 1000, ivaCents: 100, totalCents: 1100 });
  });
});
