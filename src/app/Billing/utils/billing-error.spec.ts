import { HttpErrorResponse } from '@angular/common/http';
import {
  CONCURRENT_MODIFICATION_MESSAGE,
  IDEMPOTENCY_IN_PROGRESS_CODE,
  STOCK_ERROR_MESSAGES,
  billingErrorMessage,
  isStockError,
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

describe('billingErrorMessage: errores de Inventario al emitir (BILLING_STOCK_*)', () => {
  const backMsg = 'mensaje técnico del back';

  it('mapea cada código a un mensaje en español (ignora el mensaje técnico del back)', () => {
    const cases: [string, number, string][] = [
      ['BILLING_STOCK_INSUFFICIENT', 422, 'No hay existencias suficientes en Inventario'],
      ['BILLING_STOCK_PRODUCT_NOT_AVAILABLE', 422, 'no existen o están inactivos en Inventario'],
      ['BILLING_STOCK_QUANTITY_NOT_SUPPORTED', 422, 'solo admite cantidades enteras'],
      ['BILLING_STOCK_CONFIG_MISSING', 422, 'método de valoración de inventario (PEPS o promedio ponderado)'],
      ['BILLING_STOCK_ORIGINAL_NOT_FOUND', 422, 'movimiento de la factura original'],
      ['BILLING_STOCK_UNAVAILABLE', 503, 'Inventario no está disponible'],
    ];
    for (const [code, status, expected] of cases) {
      const msg = billingErrorMessage(http(status, code, backMsg));
      expect(msg).withContext(code).toBe(STOCK_ERROR_MESSAGES[code]);
      expect(msg).withContext(code).toContain(expected);
      expect(msg).withContext(code).not.toContain(backMsg);
      expect(isStockError(http(status, code))).withContext(code).toBeTrue();
    }
  });

  it('REJECTED agrega el detalle del back (p. ej. anulación no soportada)', () => {
    const detail = 'La anulacion del documento FV-1 no esta soportada: Inventario no tiene operacion inversa.';
    expect(billingErrorMessage(http(422, 'BILLING_STOCK_REJECTED', detail))).toBe(
      `Inventario rechazó el movimiento. Detalle: ${detail}`,
    );
  });

  it('REJECTED sin detalle sugiere revisar la fecha / calendario contable', () => {
    const e = new HttpErrorResponse({ status: 422, error: { code: 'BILLING_STOCK_REJECTED' } });
    expect(billingErrorMessage(e)).toBe(
      'Inventario rechazó el movimiento. Revisa la fecha del documento (calendario contable) y vuelve a intentarlo.',
    );
    expect(billingErrorMessage(http(422, 'BILLING_STOCK_REJECTED', '   '))).toContain('calendario contable');
  });

  it('isStockError es falso para otros códigos o errores sin cuerpo', () => {
    expect(isStockError(http(409, 'BILLING_CONCURRENT_MODIFICATION'))).toBeFalse();
    expect(isStockError(new HttpErrorResponse({ status: 0 }))).toBeFalse();
    expect(isStockError(new Error('x'))).toBeFalse();
  });

  it('usa tuteo (sin voseo) en los mensajes de Inventario', () => {
    for (const msg of Object.values(STOCK_ERROR_MESSAGES)) {
      expect(msg).not.toMatch(/(Ajustá|Verificá|Configuralo|Corregí|Intentalo|volvé)/);
    }
  });
});

describe('skippedToast', () => {
  it('resume cuántos documentos no se pudieron cargar', () => {
    expect(skippedToast(3).detail).toBe('3 documentos no se pudieron cargar.');
    expect(skippedToast(1).detail).toBe('1 documento no se pudo cargar.');
    expect(skippedToast(2).severity).toBe('warn');
  });
});
