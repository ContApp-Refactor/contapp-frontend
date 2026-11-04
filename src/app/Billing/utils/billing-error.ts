import { HttpErrorResponse } from '@angular/common/http';

export const IDEMPOTENCY_CONFLICT_CODE = 'BILLING_IDEMPOTENCY_CONFLICT';
export const CONCURRENT_MODIFICATION_CODE = 'BILLING_CONCURRENT_MODIFICATION';
// 409: una creación con la misma clave sigue en curso (o colisionó)
export const IDEMPOTENCY_IN_PROGRESS_CODE = 'BILLING_IDEMPOTENCY_IN_PROGRESS';

export const CONCURRENT_MODIFICATION_MESSAGE =
  'El documento fue modificado por otra persona o en otra pestaña. Recarga para ver la versión actual.';
export const IDEMPOTENCY_IN_PROGRESS_MESSAGE = 'La operación ya se está procesando. Espera unos segundos y reintenta.';

// 409 por bloqueo optimista: la versión enviada ya no es la vigente en el back
export const isConcurrentModification = (e: unknown): boolean =>
  e instanceof HttpErrorResponse &&
  e.status === 409 &&
  (e.error as { code?: string } | null)?.code === CONCURRENT_MODIFICATION_CODE;

// Mismo error que responde el back; lo usan los mocks para simular el bloqueo optimista
export const concurrentModificationError = (): HttpErrorResponse =>
  new HttpErrorResponse({
    status: 409,
    statusText: 'Conflict',
    error: { code: CONCURRENT_MODIFICATION_CODE, message: CONCURRENT_MODIFICATION_MESSAGE },
  });

// Toast resumido cuando el listado omitió documentos que no se pudieron cargar
export const skippedToast = (skipped: number): { severity: 'warn'; summary: string; detail: string } => ({
  severity: 'warn',
  summary: 'Listado incompleto',
  detail: skipped === 1 ? '1 documento no se pudo cargar.' : `${skipped} documentos no se pudieron cargar.`,
});

// Mensaje legible para el toast a partir del error del back (BillingErrorResponse: { code, message })
export const billingErrorMessage = (e: unknown): string => {
  if (e instanceof HttpErrorResponse) {
    const body = e.error as { code?: string; message?: string } | null;
    if (body?.code === IDEMPOTENCY_CONFLICT_CODE) {
      return 'Esta operación ya se envió con datos distintos. Recarga la pantalla e inténtalo de nuevo.';
    }
    if (body?.code === IDEMPOTENCY_IN_PROGRESS_CODE) return IDEMPOTENCY_IN_PROGRESS_MESSAGE;
    if (body?.code === CONCURRENT_MODIFICATION_CODE) return CONCURRENT_MODIFICATION_MESSAGE;
    if (body?.message) return body.message;
  }
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
};
