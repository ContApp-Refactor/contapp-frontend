import { InvoiceTotals, SaleInvoice, SaleInvoiceLine } from '../models/billing-sale-invoice.model';

// Aritmética monetaria en centavos enteros. Solo se redondea una vez por línea (IVA),
// así los totales siempre cuadran con la suma de las líneas.

export const pesosToCents = (pesos: number): number => Math.round((pesos ?? 0) * 100);
export const centsToPesos = (cents: number): number => cents / 100;

// División entera con redondeo HALF_UP (como el BigDecimal del back); los operandos son enteros
const divHalfUp = (n: number, d: number): number => {
  const abs = Math.abs(n);
  const twice = 2 * abs + d;
  const q = (twice - (twice % (2 * d))) / (2 * d);
  return n < 0 ? -q : q;
};

// Aritmética SIN flotantes: la cantidad (hasta 3 decimales) se escala a milésimas enteras y el IVA (hasta 2 decimales)
// a centésimas enteras, así 1.005 × 100 = 101 como en el back y no 100 (por 1.005 × 100 = 100.49999...).
/** cantidad × precio (centavos), redondeado HALF_UP a centavos enteros. */
export const mulQtyCents = (cantidad: number, cents: number): number =>
  divHalfUp(Math.round(cantidad * 1000) * Math.round(cents), 1000);
/** base (centavos) × porcentaje / 100, redondeado HALF_UP a centavos enteros. */
export const pctOfCents = (cents: number, pct: number): number => divHalfUp(cents * Math.round(pct * 100), 10000);

export const lineSubtotalCents = (line: Pick<SaleInvoiceLine, 'cantidad' | 'precioUnitarioCents'>): number =>
  mulQtyCents(line.cantidad, line.precioUnitarioCents);

// En un documento NO editable (emitido/anulado) manda el subtotal de la línea que calculó el back (si lo envía);
// en borrador siempre se calcula con los valores en pantalla
export const lineSubtotalOf = (line: SaleInvoiceLine, editable: boolean): number =>
  !editable && line.subtotalCents != null ? line.subtotalCents : lineSubtotalCents(line);

// Una línea sin dato de IVA (nueva, aún sin guardar) se estima en 0 solo para el total provisional;
// al guardar el back devuelve el IVA real y el total se recalcula
export const lineIvaCents = (line: SaleInvoiceLine): number => pctOfCents(lineSubtotalCents(line), line.ivaPct ?? 0);

export function calcTotals(lines: SaleInvoiceLine[]): InvoiceTotals {
  let subtotalCents = 0;
  let ivaCents = 0;
  for (const line of lines) {
    subtotalCents += lineSubtotalCents(line);
    ivaCents += lineIvaCents(line);
  }
  return { subtotalCents, ivaCents, totalCents: subtotalCents + ivaCents };
}

// Totales de un documento: en un documento NO editable (emitido/anulado) mandan los `totals` del back;
// en borrador (o si el back no los envía, p. ej. el mock) se calcula con las líneas.
export function invoiceTotals(invoice: Pick<SaleInvoice, 'status' | 'lines' | 'totals'>): InvoiceTotals {
  return invoice.status !== 'BORRADOR' && invoice.totals ? invoice.totals : calcTotals(invoice.lines);
}

// Las cantidades admiten hasta 3 decimales (igual que el back)
export const roundQty = (value: number): number => Math.round(value * 1000) / 1000;

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCop = (cents: number): string => copFormatter.format(centsToPesos(cents));
