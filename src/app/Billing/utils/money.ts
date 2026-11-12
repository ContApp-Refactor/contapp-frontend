import { BillingWithholding, InvoiceTotals, SaleInvoice, SaleInvoiceLine } from '../models/billing-sale-invoice.model';
import { WithholdingCode } from '../models/document-kind';

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

// Aritmética SIN flotantes: la cantidad (entera hoy; hasta 3 decimales en documentos históricos) se escala a milésimas enteras y el IVA (hasta 2 decimales)
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

// --- Retenciones: cada una toma la TASA de su impuesto y la aplica al SUBTOTAL completo (antes de impuestos); RESTA ---

// Fila de retención lista para mostrar (formulario, vista previa, impresión)
export interface WithholdingRow {
  code: WithholdingCode;
  label: string; // "ReteIVA"
  taxName: string; // "Impuesto del gobierno"
  ratePct: number;
  amountCents: number; // positivo; se muestra con signo menos
}

const WITHHOLDING_LABELS: Record<WithholdingCode, string> = {
  RETE_IVA: 'ReteIVA',
  RETE_ICA: 'ReteICA',
  RETE_FUENTE: 'ReteFuente',
  AUTO_RENTA: 'AutoRenta',
};
export const withholdingLabel = (code: WithholdingCode): string => WITHHOLDING_LABELS[code] ?? code;

/** Monto de una retención: round(subtotal × tasa / 100) HALF_UP a centavos (igual que el IVA y TaxRate del back). */
export const withholdingAmountCents = (subtotalCents: number, ratePct: number): number =>
  pctOfCents(subtotalCents, ratePct);

/** Texto de la fila: solo el nombre de la retención ("ReteIVA"); el impuesto elegido se ve en su select. */
export const withholdingRowName = (row: Pick<WithholdingRow, 'label'>): string => row.label;

/** Filas a partir de las retenciones del back (snapshot en emitida/anulada, tasa vigente en borrador). */
export const withholdingRowsOf = (list: readonly BillingWithholding[] | null | undefined): WithholdingRow[] =>
  (list ?? []).map((w) => ({
    code: w.code,
    label: withholdingLabel(w.code),
    taxName: w.taxName,
    ratePct: w.ratePct,
    amountCents: w.amountCents,
  }));

export const sumWithholdings = (rows: readonly Pick<WithholdingRow, 'amountCents'>[]): number =>
  rows.reduce((sum, r) => sum + r.amountCents, 0);

/** Totales netos: total = subtotal + impuestos − retenciones. Sin retenciones devuelve los totales tal cual. */
export const withTotalsNet = (base: InvoiceTotals, rows: readonly Pick<WithholdingRow, 'amountCents'>[]): InvoiceTotals => {
  if (rows.length === 0) return base;
  const withholdingsCents = sumWithholdings(rows);
  return { ...base, withholdingsCents, totalCents: base.subtotalCents + base.ivaCents - withholdingsCents };
};

// Una fila del "Detalle de impuestos": un impuesto distinto (nombre + tarifa), la base sobre la que se aplica
// (suma de los subtotales de las líneas que lo tienen) y su valor (base × tarifa), SIN redondear.
export interface TaxSummaryRow {
  name: string;
  baseCents: number;
  taxCents: number;
}

// Desglose por impuesto de las líneas. Solo presentación: no cambia el IVA de las líneas ni los totales del documento.
// Una línea con `taxes` aporta a cada uno de sus impuestos; una sin desglose pero con `ivaPct` > 0 (documento viejo,
// IVA por defecto o editado a mano) aporta a una fila única "Iva"; sin impuestos no aporta nada.
export function taxSummaryRows(lines: SaleInvoiceLine[], editable: boolean): TaxSummaryRow[] {
  return taxSheetRows(lines, editable).map((g) => ({
    name: `${g.name} ${g.rate}%`,
    baseCents: g.baseCents,
    taxCents: g.taxCents,
  }));
}

// Misma agrupación que `taxSummaryRows`, pero con el nombre y la tasa por separado (cuadro IMPUESTOS de la hoja impresa)
export interface TaxSheetRow {
  name: string; // "Iva"
  rate: number; // 19
  baseCents: number;
  taxCents: number; // base × tarifa, SIN redondear
}

export function taxSheetRows(lines: SaleInvoiceLine[], editable: boolean): TaxSheetRow[] {
  const groups = new Map<string, { name: string; rate: number; baseCents: number }>();
  for (const line of lines) {
    const taxes = line.taxes?.length ? line.taxes : line.ivaPct ? [{ name: 'Iva', rate: line.ivaPct }] : [];
    const base = lineSubtotalOf(line, editable);
    for (const tax of taxes) {
      const key = `${tax.name.trim().toLowerCase()}|${tax.rate}`;
      const group = groups.get(key) ?? { name: tax.name.trim(), rate: tax.rate, baseCents: 0 };
      group.baseCents += base;
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((g) => ({
    name: g.name,
    rate: g.rate,
    baseCents: g.baseCents,
    taxCents: (g.baseCents * Math.round(g.rate * 100)) / 10000,
  }));
}

// Impuestos de UNA línea en centavos (suma de todos sus impuestos), con el mismo redondeo que el total del documento:
// subtotal de la línea × `ivaPct` (la suma de las tarifas); sin `ivaPct` se suman las tarifas del desglose.
export const lineTaxCentsOf = (line: SaleInvoiceLine, editable: boolean): number => {
  const pct = line.ivaPct ?? (line.taxes ?? []).reduce((sum, t) => sum + Number(t.rate), 0);
  return pctOfCents(lineSubtotalOf(line, editable), pct);
};

// Totales de un documento: en un documento NO editable (emitido/anulado) mandan los `totals` del back;
// en borrador (o si el back no los envía, p. ej. el mock) se calcula con las líneas.
// En borrador las retenciones (si las hay) se restan del total calculado con las líneas.
export function invoiceTotals(invoice: Pick<SaleInvoice, 'status' | 'lines' | 'totals' | 'withholdings'>): InvoiceTotals {
  if (invoice.status !== 'BORRADOR' && invoice.totals) return invoice.totals;
  return withTotalsNet(calcTotals(invoice.lines), withholdingRowsOf(invoice.withholdings));
}

// Redondeo a 3 decimales: SOLO para aritmética/visualización de documentos históricos (antes de la integración con
// Inventario se admitían hasta 3 decimales) y para evitar errores de flotante (p. ej. 2.9999999 -> 3) al sumar/restar.
export const roundQty = (value: number): number => Math.round(value * 1000) / 1000;

// Inventario solo admite cantidades ENTERAS: es la regla para todo lo que se captura o se envía (facturas y devoluciones)
export const MIN_QUANTITY = 1;
export const isWholeQty = (value: number): boolean => Number.isInteger(roundQty(value));
/** Parte entera (hacia abajo) de una cantidad; nunca supera el valor original (p. ej. disponible 2.5 -> 2). */
export const wholeQty = (value: number): number => Math.floor(roundQty(value));

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCop = (cents: number): string => copFormatter.format(centsToPesos(cents));
