import { HttpErrorResponse } from '@angular/common/http';

export const IDEMPOTENCY_CONFLICT_CODE = 'BILLING_IDEMPOTENCY_CONFLICT';
export const CONCURRENT_MODIFICATION_CODE = 'BILLING_CONCURRENT_MODIFICATION';
// 409: una creación con la misma clave sigue en curso (o colisionó)
export const IDEMPOTENCY_IN_PROGRESS_CODE = 'BILLING_IDEMPOTENCY_IN_PROGRESS';
// 409: el N.º de factura del proveedor ya lo usa otra factura de compra del mismo proveedor
export const DUPLICATE_SUPPLIER_INVOICE_CODE = 'BILLING_DUPLICATE_SUPPLIER_INVOICE';

// 422: pago de la factura de venta (método obligatorio y válido)
export const PAYMENT_METHOD_REQUIRED_CODE = 'BILLING_PAYMENT_METHOD_REQUIRED';
export const PAYMENT_METHOD_INVALID_CODE = 'BILLING_PAYMENT_METHOD_INVALID';

export const PAYMENT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [PAYMENT_METHOD_REQUIRED_CODE]: 'Selecciona el método de pago de la factura.',
  [PAYMENT_METHOD_INVALID_CODE]: 'El método de pago no existe, está inactivo o no es de esta empresa. Elige otro en la lista.',
};

// 422: retenciones de la factura
export const WITHHOLDING_INVALID_CODE = 'BILLING_WITHHOLDING_INVALID';
export const WITHHOLDING_TAX_INVALID_CODE = 'BILLING_WITHHOLDING_TAX_INVALID';
export const TOTAL_NEGATIVE_CODE = 'BILLING_TOTAL_NEGATIVE';

export const WITHHOLDING_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [WITHHOLDING_INVALID_CODE]: 'Alguna retención no es válida. Revisa las retenciones marcadas y sus impuestos (AutoRenta solo aplica en ventas).',
  [WITHHOLDING_TAX_INVALID_CODE]:
    'El impuesto elegido en una retención no existe o está inactivo. Elige otro impuesto para esa retención.',
  [TOTAL_NEGATIVE_CODE]: 'Las retenciones superan el subtotal más los impuestos. Revisa los impuestos elegidos en las retenciones.',
};

export const CONCURRENT_MODIFICATION_MESSAGE =
  'El documento fue modificado por otra persona o en otra pestaña. Recarga para ver la versión actual.';
export const DUPLICATE_SUPPLIER_INVOICE_MESSAGE =
  'Ya existe una factura de compra de este proveedor con ese N.º. Usa un número diferente.';
export const IDEMPOTENCY_IN_PROGRESS_MESSAGE = 'La operación ya se está procesando. Espera unos segundos y reintenta.';

// 409 por bloqueo optimista: la versión enviada ya no es la vigente en el back
export const isConcurrentModification = (e: unknown): boolean =>
  e instanceof HttpErrorResponse &&
  e.status === 409 &&
  (e.error as { code?: string } | null)?.code === CONCURRENT_MODIFICATION_CODE;

// 409 por N.º de factura del proveedor repetido (se valida al guardar el borrador y al emitir)
export const isDuplicateSupplierInvoice = (e: unknown): boolean =>
  e instanceof HttpErrorResponse &&
  e.status === 409 &&
  (e.error as { code?: string } | null)?.code === DUPLICATE_SUPPLIER_INVOICE_CODE;

// Mismo error que responde el back; lo usan los mocks para simular el bloqueo optimista
export const concurrentModificationError = (): HttpErrorResponse =>
  new HttpErrorResponse({
    status: 409,
    statusText: 'Conflict',
    error: { code: CONCURRENT_MODIFICATION_CODE, message: CONCURRENT_MODIFICATION_MESSAGE },
  });

// Mismo error 422 que responde el back por la forma de pago; lo usan los mocks
export const paymentApiError = (code: string): HttpErrorResponse =>
  new HttpErrorResponse({
    status: 422,
    statusText: 'Unprocessable Entity',
    error: { code, message: PAYMENT_ERROR_MESSAGES[code] },
  });

// Toast resumido cuando el listado omitió documentos que no se pudieron cargar
export const skippedToast = (skipped: number): { severity: 'warn'; summary: string; detail: string } => ({
  severity: 'warn',
  summary: 'Listado incompleto',
  detail: skipped === 1 ? '1 documento no se pudo cargar.' : `${skipped} documentos no se pudieron cargar.`,
});

// --- Integración con Inventario: el back mueve el kardex al EMITIR (misma transacción). Si Inventario falla la emisión se
// revierte y el documento queda en BORRADOR sin número. Todos son 422 salvo BILLING_STOCK_UNAVAILABLE (503).
export const STOCK_INSUFFICIENT_CODE = 'BILLING_STOCK_INSUFFICIENT';
export const STOCK_PRODUCT_NOT_AVAILABLE_CODE = 'BILLING_STOCK_PRODUCT_NOT_AVAILABLE';
export const STOCK_QUANTITY_NOT_SUPPORTED_CODE = 'BILLING_STOCK_QUANTITY_NOT_SUPPORTED';
export const STOCK_CONFIG_MISSING_CODE = 'BILLING_STOCK_CONFIG_MISSING';
export const STOCK_ORIGINAL_NOT_FOUND_CODE = 'BILLING_STOCK_ORIGINAL_NOT_FOUND';
// También lo usa la anulación de un documento emitido (Inventario no tiene operación inversa)
export const STOCK_REJECTED_CODE = 'BILLING_STOCK_REJECTED';
export const STOCK_PERIOD_CLOSED_CODE = 'BILLING_STOCK_PERIOD_CLOSED';
export const STOCK_UNAVAILABLE_CODE = 'BILLING_STOCK_UNAVAILABLE';

export const STOCK_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [STOCK_INSUFFICIENT_CODE]:
    'No hay existencias suficientes en Inventario para uno o más productos. Ajusta las cantidades o registra primero la entrada de mercancía y vuelve a intentarlo.',
  [STOCK_PRODUCT_NOT_AVAILABLE_CODE]:
    'Uno o más productos no existen o están inactivos en Inventario (puede que aún no se hayan sincronizado). Verifica el producto en Inventario y vuelve a intentarlo.',
  [STOCK_QUANTITY_NOT_SUPPORTED_CODE]:
    'Inventario solo admite cantidades enteras. Corrige las cantidades con decimales y vuelve a intentarlo.',
  [STOCK_CONFIG_MISSING_CODE]:
    'La empresa no tiene configurado el método de valoración de inventario (PEPS o promedio ponderado). Configúralo en Inventario antes de emitir.',
  [STOCK_ORIGINAL_NOT_FOUND_CODE]:
    'Inventario no tiene registrado el movimiento de la factura original (p. ej. se emitió antes de la integración con Inventario), por eso no se puede registrar la devolución.',
  [STOCK_PERIOD_CLOSED_CODE]:
    'Inventario rechazó el movimiento debido a que el mes está cerrado o no existe. Abre el mes en el calendario contable o cambia la fecha del documento.',
  [STOCK_REJECTED_CODE]: 'Inventario rechazó el movimiento.',
  [STOCK_UNAVAILABLE_CODE]: 'Inventario no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
};

// Sin detalle del back, REJECTED sugiere la causa más frecuente
const STOCK_REJECTED_FALLBACK = 'Revisa la fecha del documento (calendario contable) y vuelve a intentarlo.';

const errorCode = (e: unknown): string | undefined =>
  e instanceof HttpErrorResponse ? (e.error as { code?: string } | null)?.code : undefined;

/** Error de Inventario al emitir: la emisión se revirtió (el documento sigue en borrador, sin número). */
export const isStockError = (e: unknown): boolean => {
  const code = errorCode(e);
  return code !== undefined && code in STOCK_ERROR_MESSAGES;
};

// REJECTED es heterogéneo (calendario contable, registro duplicado, anulación no soportada...): se agrega el detalle del back
const stockMessage = (code: string, detail: string | undefined): string => {
  const base = STOCK_ERROR_MESSAGES[code];
  if (code === STOCK_PRODUCT_NOT_AVAILABLE_CODE) {
    // El back nombra el producto ("El producto 7 (P-7 X) no existe o esta inactivo..."): se muestra cuál es
    const producto = /^(?:El\s+)?(producto[^]*?)\s+no existe o esta inactivo/i.exec(detail?.trim() ?? '')?.[1];
    return producto ? `${base} Producto: ${producto}.` : base;
  }
  if (code !== STOCK_REJECTED_CODE) return base;
  const text = detail?.trim();
  return text ? `${base} Detalle: ${text}` : `${base} ${STOCK_REJECTED_FALLBACK}`;
};

/** Error de forma de pago de la factura de venta (422): el documento sigue en borrador. */
export const isPaymentError = (e: unknown): boolean => {
  const code = errorCode(e);
  return code !== undefined && code in PAYMENT_ERROR_MESSAGES;
};

// Mensaje legible para el toast a partir del error del back (BillingErrorResponse: { code, message })
export const billingErrorMessage = (e: unknown): string => {
  if (e instanceof HttpErrorResponse) {
    const body = e.error as { code?: string; message?: string } | null;
    if (body?.code && body.code in STOCK_ERROR_MESSAGES) return stockMessage(body.code, body.message);
    // El back arma un mensaje claro en español; si no llega se usa el de respaldo del código
    if (body?.code && body.code in PAYMENT_ERROR_MESSAGES) {
      return body.message?.trim() || PAYMENT_ERROR_MESSAGES[body.code];
    }
    // Los mensajes propios son más claros que el técnico del back
    if (body?.code && body.code in WITHHOLDING_ERROR_MESSAGES) return WITHHOLDING_ERROR_MESSAGES[body.code];
    if (body?.code === IDEMPOTENCY_CONFLICT_CODE) {
      return 'Esta operación ya se envió con datos distintos. Recarga la pantalla e inténtalo de nuevo.';
    }
    if (body?.code === IDEMPOTENCY_IN_PROGRESS_CODE) return IDEMPOTENCY_IN_PROGRESS_MESSAGE;
    if (body?.code === CONCURRENT_MODIFICATION_CODE) return CONCURRENT_MODIFICATION_MESSAGE;
    // El back arma el mensaje con el número (y el consecutivo si ya está emitida); sin él se usa el genérico
    if (body?.code === DUPLICATE_SUPPLIER_INVOICE_CODE) return body.message?.trim() || DUPLICATE_SUPPLIER_INVOICE_MESSAGE;
    if (body?.message) return body.message;
  }
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
};
