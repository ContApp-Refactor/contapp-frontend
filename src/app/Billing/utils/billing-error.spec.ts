import { HttpErrorResponse } from '@angular/common/http';
import {
  CONCURRENT_MODIFICATION_MESSAGE,
  IDEMPOTENCY_IN_PROGRESS_CODE,
  billingErrorMessage,
  skippedToast,
} from './billing-error';

const http = (status: number, code: string, message = 'x') => new HttpErrorResponse({ status, error: { code, message } });

describe('billingErrorMessage', () => {
  it('409 BILLING_IDEMPOTENCY_IN_PROGRESS: la operación ya se está procesando', () => {
    expect(billingErrorMessage(http(409, IDEMPOTENCY_IN_PROGRESS_CODE))).toBe(
      'La operación ya se está procesando. Espera unos segundos y reintenta.',
    );
  });

  it('409 BILLING_IDEMPOTENCY_CONFLICT: datos distintos', () => {
    expect(billingErrorMessage(http(409, 'BILLING_IDEMPOTENCY_CONFLICT'))).toContain('datos distintos');
  });

  it('toda la UI usa tuteo (sin voseo)', () => {
    expect(CONCURRENT_MODIFICATION_MESSAGE).toBe(
      'El documento fue modificado por otra persona o en otra pestaña. Recarga para ver la versión actual.',
    );
    expect(billingErrorMessage(http(409, 'BILLING_CONCURRENT_MODIFICATION'))).toContain('Recarga para ver');
    expect(billingErrorMessage(http(409, 'BILLING_CONCURRENT_MODIFICATION'))).not.toContain('Recargá');
  });

  it('sin código usa el mensaje del back o uno genérico', () => {
    expect(billingErrorMessage(http(400, 'OTRO', 'Mensaje del back'))).toBe('Mensaje del back');
    expect(billingErrorMessage('???')).toBe('Ocurrió un error inesperado.');
  });
});

describe('skippedToast', () => {
  it('resume cuántos documentos no se pudieron cargar', () => {
    expect(skippedToast(3).detail).toBe('3 documentos no se pudieron cargar.');
    expect(skippedToast(1).detail).toBe('1 documento no se pudo cargar.');
    expect(skippedToast(2).severity).toBe('warn');
  });
});
