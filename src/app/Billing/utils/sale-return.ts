import { InvoiceTotals, SaleInvoiceLine } from '../models/billing-sale-invoice.model';
import {
  InvoiceReturnState,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnLine,
} from '../models/billing-sale-return.model';

// Funciones puras de devoluciones: disponibilidad, estado derivado y totales.

export const RETURN_STATE_LABEL: Record<InvoiceReturnState, string> = {
  SIN_DEVOLUCION: 'Sin devolución',
  PARCIAL: 'Parcial',
  TOTAL: 'Total',
};

/** Cantidad ya devuelta por producto: solo cuentan devoluciones EMITIDA (no borradores ni anuladas). */
export function returnedByProduct(returns: Pick<SaleReturn, 'status' | 'lines'>[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of returns) {
    if (r.status !== 'EMITIDA') continue;
    for (const l of r.lines) {
      map.set(l.productId, (map.get(l.productId) ?? 0) + l.cantidadDevuelta);
    }
  }
  return map;
}

/** Vendido / ya devuelto / disponible por línea de la factura original. */
export function buildAvailability(
  invoiceLines: SaleInvoiceLine[],
  returns: Pick<SaleReturn, 'status' | 'lines'>[],
): ReturnAvailabilityLine[] {
  const returned = returnedByProduct(returns);
  return invoiceLines.map((l) => {
    const done = returned.get(l.productId) ?? 0;
    return {
      productId: l.productId,
      productName: l.productName,
      sold: l.cantidad,
      returned: done,
      available: Math.max(0, l.cantidad - done),
      precioUnitarioCents: l.precioUnitarioCents,
      ivaPct: l.ivaPct,
    };
  });
}

/** SIN_DEVOLUCION / PARCIAL / TOTAL a partir de las líneas vendidas y las devoluciones emitidas. */
export function deriveReturnState(
  invoiceLines: SaleInvoiceLine[],
  returns: Pick<SaleReturn, 'status' | 'lines'>[],
): InvoiceReturnState {
  const availability = buildAvailability(invoiceLines, returns);
  if (availability.every((a) => a.returned === 0)) return 'SIN_DEVOLUCION';
  return availability.every((a) => a.available === 0) ? 'TOTAL' : 'PARCIAL';
}

/**
 * Ordinal (1, 2, 3...) de cada devolución dentro de su factura: posición entre las que ya
 * tienen número, ordenadas por número ascendente. Las ANULADAS conservan su ordinal;
 * los borradores (sin número) no tienen ordinal.
 */
export function returnOrdinals(returns: Pick<SaleReturn, 'id' | 'number'>[]): Map<string, number> {
  const numbered = returns
    .filter((r): r is Pick<SaleReturn, 'id' | 'number'> & { number: string } => !!r.number)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  return new Map(numbered.map((r, i) => [r.id, i + 1]));
}

// Aritmética igual a la de la factura (utils/money.ts): se redondea una vez por línea (IVA)
type AmountLine = Pick<SaleReturnLine, 'cantidadDevuelta' | 'precioUnitarioCents' | 'ivaPct'>;

export const returnLineSubtotalCents = (line: AmountLine): number =>
  Math.round(line.cantidadDevuelta * line.precioUnitarioCents);

export const returnLineIvaCents = (line: AmountLine): number =>
  Math.round((returnLineSubtotalCents(line) * line.ivaPct) / 100);

export function calcReturnTotals(lines: AmountLine[]): InvoiceTotals {
  let subtotalCents = 0;
  let ivaCents = 0;
  for (const line of lines) {
    subtotalCents += returnLineSubtotalCents(line);
    ivaCents += returnLineIvaCents(line);
  }
  return { subtotalCents, ivaCents, totalCents: subtotalCents + ivaCents };
}
