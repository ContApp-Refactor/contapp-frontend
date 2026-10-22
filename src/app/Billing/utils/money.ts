import { InvoiceTotals, SaleInvoiceLine } from '../models/billing-sale-invoice.model';

// Aritmética monetaria en centavos enteros. Solo se redondea una vez por línea (IVA),
// así los totales siempre cuadran con la suma de las líneas.

export const pesosToCents = (pesos: number): number => Math.round((pesos ?? 0) * 100);
export const centsToPesos = (cents: number): number => cents / 100;

export const lineSubtotalCents = (line: SaleInvoiceLine): number =>
  Math.round(line.cantidad * line.precioUnitarioCents);

export const lineIvaCents = (line: SaleInvoiceLine): number =>
  Math.round((lineSubtotalCents(line) * line.ivaPct) / 100);

export function calcTotals(lines: SaleInvoiceLine[]): InvoiceTotals {
  let subtotalCents = 0;
  let ivaCents = 0;
  for (const line of lines) {
    subtotalCents += lineSubtotalCents(line);
    ivaCents += lineIvaCents(line);
  }
  return { subtotalCents, ivaCents, totalCents: subtotalCents + ivaCents };
}

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCop = (cents: number): string => copFormatter.format(centsToPesos(cents));
