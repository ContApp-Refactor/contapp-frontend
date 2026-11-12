import { BillingLineTax } from '../models/billing-sale-invoice.model';

// Desglose de impuestos por línea (solo PRESENTACIÓN). El cálculo del impuesto de la línea sigue usando `ivaPct`, que es
// la SUMA de las tarifas (subtotal × suma / 100, mismo redondeo de siempre): estas funciones nunca suman para calcular.

// Tarifa con a lo sumo 2 decimales, sin ceros de relleno (19 -> "19", 12.5 -> "12.5")
export const formatTaxRate = (rate: number): string => String(Math.round(Number(rate) * 100) / 100);

// "Nombre: 19%". El nombre llega tal como está en Inventario/maestro de impuestos ("Iva", "Ica"); solo se normaliza el formato
export const formatTaxLabel = (tax: BillingLineTax): string => `${tax.name.trim()}: ${formatTaxRate(tax.rate)}%`;

// Valor único (documentos viejos sin desglose, IVA por defecto o editado a mano): "19%" o "—" sin dato
export const formatSingleRate = (rate: number | null | undefined): string =>
  rate != null ? `${formatTaxRate(rate)}%` : '—';

// La línea trae impuestos de categoría => desglose de SOLO LECTURA. Sin desglose (o vacío) => valor único editable en borrador
export const hasTaxBreakdown = (line: { taxes?: BillingLineTax[] | null }): boolean => (line.taxes?.length ?? 0) > 0;

// Igualdad por valor de dos desgloses (para no recrear filas si el back devuelve lo mismo)
export const sameTaxes = (a: BillingLineTax[] | null | undefined, b: BillingLineTax[] | null | undefined): boolean => {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((t, i) => t.name === y[i].name && Number(t.rate) === Number(y[i].rate));
};

// Normaliza el desglose que llega del back (rate puede venir como string en JSON de BigDecimal)
export const toLineTaxes = (taxes: { name: string; rate: number | string }[] | null | undefined): BillingLineTax[] =>
  (taxes ?? []).map((t) => ({ name: t.name, rate: Number(t.rate) }));
