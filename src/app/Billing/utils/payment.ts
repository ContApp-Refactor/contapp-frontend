import { BillingPayment } from '../models/billing-sale-invoice.model';

// Reglas del pago de la factura de venta (compartidas por formulario, adaptador HTTP, mock y vista previa).

export const NO_PAYMENT_METHODS_MESSAGE = 'No hay métodos de pago. Créalos en Maestros Generales > Métodos de Pago';

/** Línea de la vista previa/PDF: nombre del método. Sin método (venta anterior) => "—". */
export const paymentSummary = (payment: BillingPayment | null | undefined): string => payment?.methodName || '—';

/** Cuerpo del pago que viaja al back: solo el método. */
export const paymentBody = (payment: BillingPayment | null | undefined): { methodId: string | null } | null => {
  if (!payment) return null;
  return { methodId: payment.methodId ?? null };
};
