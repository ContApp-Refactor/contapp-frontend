/** Etiquetas visuales en español para Tesorería (no alteran enums/API). */
const VOUCHER_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTING: 'Contabilizando',
  POSTED: 'Contabilizado',
  FAILED: 'Fallido',
  VOIDING: 'Anulando',
  VOIDED: 'Anulado',
  VOID_FAILED: 'Anulación fallida',
};

const SCHEDULE_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  PROCESSING: 'En proceso',
  WAITING_ACCOUNTING: 'Esperando contabilización',
  EXECUTED: 'Ejecutado',
  FAILED: 'Fallido',
  CANCELED: 'Cancelado',
};

const PAYABLE_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Pendiente de pago',
  PARTIALLY_PAID: 'Abono parcial',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  Bill: 'Factura de compra',
  Payment: 'Pago a proveedor',
  PaymentReversal: 'Reversión pago',
  WriteOff: 'Baja CxP',
  WriteOffReversal: 'Reversión Baja CxP',
};

const ACCOUNTING_ENTRY_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  VOIDED: 'Anulado',
};

const ACCOUNTING_SOURCE_TYPE_LABELS: Record<string, string> = {
  PAYMENT_VOUCHER: 'Comprobante de egreso',
  PAYABLE_WRITEOFF: 'Baja de cuenta por pagar',
};

const PAYMENT_METHOD_NAME_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia bancaria',
  BANK_TRANSFER: 'Transferencia bancaria',
  BANK: 'Transferencia bancaria',
  CHECK: 'Cheque',
  CHEQUE: 'Cheque',
  CREDIT_CARD: 'Tarjeta',
  CARD: 'Tarjeta',
  DEBIT_CARD: 'Tarjeta débito',
};

export function voucherStatusLabel(status?: string | null): string {
  if (!status) return 'Desconocido';
  return VOUCHER_LABELS[status] ?? 'Desconocido';
}

export function scheduleStatusLabel(status?: string | null): string {
  if (!status) return 'Desconocido';
  return SCHEDULE_LABELS[status] ?? 'Desconocido';
}

export function payableStatusLabel(status?: string | null): string {
  if (!status) return 'Desconocido';
  return PAYABLE_LABELS[status] ?? 'Desconocido';
}

export function transactionTypeLabel(type?: string | null): string {
  if (!type) return '-';
  return TRANSACTION_TYPE_LABELS[type] ?? 'Desconocido';
}

export function accountingEntryStatusLabel(status?: string | null): string {
  if (!status) return '-';
  return ACCOUNTING_ENTRY_LABELS[status] ?? 'Desconocido';
}

export function accountingSourceDocumentTypeLabel(type?: string | null): string {
  if (!type) return '-';
  return ACCOUNTING_SOURCE_TYPE_LABELS[type] ?? type;
}

export function scheduleStatusFilterOptions(includeAll = true) {
  const options = Object.entries(SCHEDULE_LABELS).map(([value, label]) => ({ label, value }));
  return includeAll ? [{ label: 'Todos los estados', value: '' }, ...options] : options;
}

export function voucherStatusFilterOptions(includeAll = true) {
  const options = Object.entries(VOUCHER_LABELS).map(([value, label]) => ({ label, value }));
  return includeAll ? [{ label: 'Todos los estados', value: '' }, ...options] : options;
}

export function exportFormatLabel(format: 'csv' | 'pdf'): string {
  return format === 'pdf' ? 'PDF' : 'CSV';
}

export function exportSuccessDetail(context: string, format: 'csv' | 'pdf'): string {
  return `Se descargó el ${exportFormatLabel(format)} de ${context}.`;
}

export function exportErrorDetail(format: 'csv' | 'pdf'): string {
  return `No se pudo exportar el ${exportFormatLabel(format)}.`;
}

/** Traduce nombres/códigos visibles de métodos de pago sin tocar el valor interno. */
export function translatePaymentMethodName(name?: string | null): string {
  const text = (name ?? '').trim();
  if (!text) return '-';

  const normalized = text.toUpperCase().replace(/[\s-]+/g, '_');
  if (PAYMENT_METHOD_NAME_LABELS[normalized]) {
    return PAYMENT_METHOD_NAME_LABELS[normalized];
  }

  const replacements: Array<[RegExp, string]> = [
    [/\bbank[\s_-]?transfer\b/i, 'Transferencia bancaria'],
    [/\btransfer\b/i, 'Transferencia bancaria'],
    [/\bfull[\s_-]?cash\b/i, 'Pago total en efectivo'],
    [/\bcredit[\s_-]?card\b/i, 'Tarjeta'],
    [/\bcheck\b/i, 'Cheque'],
    [/\bcash\b/i, 'Efectivo'],
  ];

  let result = text;
  for (const [pattern, label] of replacements) {
    result = result.replace(pattern, label);
  }
  return result;
}

/** Observaciones técnicas → texto educativo en español. */
const LAB_DESCRIPTION_PATTERNS: Array<{ test: RegExp; label: string }> = [
  { test: /\bvoid\b/i, label: 'Anulación de comprobante' },
  { test: /\bmulti\b/i, label: 'Pago múltiple' },
  { test: /\bbank[\s_-]?transfer\b|\bbank\b/i, label: 'Transferencia bancaria' },
  { test: /\bpart\b|\babono\b/i, label: 'Abono parcial' },
  { test: /\bfull[\s_-]?cash\b|\bfull\b/i, label: 'Pago total en efectivo' },
  { test: /\bover\b/i, label: 'Intento de pago por más del saldo' },
  { test: /\bsched\b/i, label: 'Pago programado' },
];

export function educationalDescription(raw?: string | null, fallback = 'Pago a proveedor'): string {
  const text = (raw ?? '').trim();
  if (!text) return fallback;
  if (/^\d+$/.test(text)) return fallback;

  for (const { test, label } of LAB_DESCRIPTION_PATTERNS) {
    if (test.test(text)) return label;
  }

  const paymentOfInvoices = text.match(/^Pago de (\d+)\s*factura\(s\):\s*(.+)$/i);
  if (paymentOfInvoices) {
    const count = Number(paymentOfInvoices[1]);
    const refs = paymentOfInvoices[2].trim();
    const noun = count === 1 ? 'factura' : 'facturas';
    return `Pago de ${count} ${noun}: ${refs}`;
  }

  return translatePaymentMethodName(text);
}

export function reportEmptyFiltersMessage(): string {
  return 'No hay información para los filtros seleccionados';
}
