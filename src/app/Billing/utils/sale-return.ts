import { InvoiceTotals, SaleInvoiceLine } from '../models/billing-sale-invoice.model';
import { mulQtyCents, pctOfCents, roundQty } from './money';
import {
  InvoiceReturnState,
  ReturnAvailabilityLine,
  SaleReturn,
  SaleReturnLine,
} from '../models/billing-sale-return.model';

// Funciones puras de devoluciones: disponibilidad, estado derivado y totales.

// Etiqueta de la factura según su estado de devolución (formulario, listados y "Facturas con devolución");
// sin devolución no hay etiqueta
export const RETURNED_INVOICE_LABEL: Partial<Record<InvoiceReturnState, string>> = {
  PARCIAL: 'Devuelta parcialmente',
  TOTAL: 'Devuelta',
};

// Mismas etiquetas en todas las pantallas (solo SIN_DEVOLUCION tiene una propia)
export const RETURN_STATE_LABEL: Record<InvoiceReturnState, string> = {
  SIN_DEVOLUCION: 'Sin devolución',
  PARCIAL: RETURNED_INVOICE_LABEL.PARCIAL!,
  TOTAL: RETURNED_INVOICE_LABEL.TOTAL!,
};

/** Número de línea de la factura original: el que envía el back o, si falta, su posición (1, 2, 3...). */
export const lineNumberOf = (line: Pick<SaleInvoiceLine, 'lineNo'>, index: number): number => line.lineNo ?? index + 1;

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

/**
 * Cantidad ya devuelta por línea (lineNo) de la factura original: solo cuentan devoluciones EMITIDA.
 * Una línea de devolución sin `sourceLineNo` (datos antiguos del mock) se asigna a la primera línea de su producto.
 */
export function returnedByLine(
  invoiceLines: Pick<SaleInvoiceLine, 'lineNo' | 'productId'>[],
  returns: Pick<SaleReturn, 'status' | 'lines'>[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of returns) {
    if (r.status !== 'EMITIDA') continue;
    for (const l of r.lines) {
      const index = invoiceLines.findIndex((x) => x.productId === l.productId);
      const lineNo = l.sourceLineNo ?? (index >= 0 ? lineNumberOf(invoiceLines[index], index) : undefined);
      if (lineNo === undefined) continue;
      map.set(lineNo, roundQty((map.get(lineNo) ?? 0) + l.cantidadDevuelta));
    }
  }
  return map;
}

/** Vendido / ya devuelto / disponible por línea de la factura original. */
export function buildAvailability(
  invoiceLines: SaleInvoiceLine[],
  returns: Pick<SaleReturn, 'status' | 'lines'>[],
): ReturnAvailabilityLine[] {
  const returned = returnedByLine(invoiceLines, returns);
  return invoiceLines.map((l, index) => {
    const lineNo = lineNumberOf(l, index);
    const done = returned.get(lineNo) ?? 0;
    return {
      lineNo,
      productId: l.productId,
      productName: l.productName,
      sold: l.cantidad,
      returned: done,
      available: Math.max(0, roundQty(l.cantidad - done)),
      precioUnitarioCents: l.precioUnitarioCents,
      ivaPct: l.ivaPct ?? 0, // una factura emitida siempre trae IVA del back
      ...(l.taxes?.length ? { taxes: l.taxes } : {}), // la devolución hereda el desglose de la línea original
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

// Aritmética igual a la de la factura (utils/money.ts, enteros HALF_UP sin flotantes): se redondea una vez por línea (IVA)
type AmountLine = Pick<SaleReturnLine, 'cantidadDevuelta' | 'precioUnitarioCents' | 'ivaPct'>;

export const returnLineSubtotalCents = (line: AmountLine): number =>
  mulQtyCents(line.cantidadDevuelta, line.precioUnitarioCents);

// En una devolución NO editable manda el subtotal de la línea que calculó el back (si lo envía)
export const returnLineSubtotalOf = (line: AmountLine & Pick<SaleReturnLine, 'subtotalCents'>, editable: boolean): number =>
  !editable && line.subtotalCents != null ? line.subtotalCents : returnLineSubtotalCents(line);

export const returnLineIvaCents = (line: AmountLine): number => pctOfCents(returnLineSubtotalCents(line), line.ivaPct);

// Totales de una devolución: en una NO editable mandan los `totals` del back; en borrador se calculan con las líneas
export function returnTotals(saleReturn: Pick<SaleReturn, 'status' | 'lines' | 'totals'>): InvoiceTotals {
  return saleReturn.status !== 'BORRADOR' && saleReturn.totals ? saleReturn.totals : calcReturnTotals(saleReturn.lines);
}

export function calcReturnTotals(lines: AmountLine[]): InvoiceTotals {
  let subtotalCents = 0;
  let ivaCents = 0;
  for (const line of lines) {
    subtotalCents += returnLineSubtotalCents(line);
    ivaCents += returnLineIvaCents(line);
  }
  return { subtotalCents, ivaCents, totalCents: subtotalCents + ivaCents };
}
