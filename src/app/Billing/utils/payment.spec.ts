import { HttpErrorResponse } from '@angular/common/http';
import {
  PAYMENT_ERROR_MESSAGES,
  PAYMENT_METHOD_INVALID_CODE,
  PAYMENT_METHOD_REQUIRED_CODE,
  billingErrorMessage,
  isPaymentError,
  paymentApiError,
} from './billing-error';
import { paymentBody, paymentSummary } from './payment';

describe('paymentSummary (vista previa / PDF)', () => {
  it('solo el nombre del método', () => {
    expect(paymentSummary({ methodId: '7', methodName: 'Efectivo' })).toBe('Efectivo');
  });

  it('ignora campos de banco que lleguen (ya no existen): solo el nombre', () => {
    const legacy = { methodId: '9', methodName: 'Transferencia', bankAccountName: 'Banco ····7890' };
    expect(paymentSummary(legacy)).toBe('Transferencia');
  });

  it('sin método (venta anterior o borrador sin elegir): "—"', () => {
    expect(paymentSummary(null)).toBe('—');
    expect(paymentSummary(undefined)).toBe('—');
    expect(paymentSummary({ methodId: null })).toBe('—');
  });
});

describe('paymentBody (lo que viaja al back)', () => {
  it('solo methodId, sin nombres', () => {
    expect(paymentBody({ methodId: '7', methodName: 'Efectivo' })).toEqual({ methodId: '7' });
  });

  it('nunca envía campos de banco aunque lleguen; sin pago => null', () => {
    const legacy = { methodId: '9', bankAccountId: '3' } as never;
    expect(paymentBody(legacy)).toEqual({ methodId: '9' });
    expect(paymentBody({ methodId: null })).toEqual({ methodId: null });
    expect(paymentBody(null)).toBeNull();
  });
});

describe('códigos de error de pago', () => {
  const http = (code: string, message?: string) =>
    new HttpErrorResponse({ status: 422, error: message === undefined ? { code } : { code, message } });

  it('los dos códigos vigentes se reconocen como errores de pago', () => {
    for (const code of [PAYMENT_METHOD_REQUIRED_CODE, PAYMENT_METHOD_INVALID_CODE]) {
      expect(isPaymentError(http(code))).toBeTrue();
    }
    expect(isPaymentError(http('BILLING_DRAFT_INCOMPLETE'))).toBeFalse();
    expect(isPaymentError(new Error('x'))).toBeFalse();
  });

  it('los códigos son los acordados con el back y los eliminados ya no existen', () => {
    expect(PAYMENT_METHOD_REQUIRED_CODE).toBe('BILLING_PAYMENT_METHOD_REQUIRED');
    expect(PAYMENT_METHOD_INVALID_CODE).toBe('BILLING_PAYMENT_METHOD_INVALID');
    expect(Object.keys(PAYMENT_ERROR_MESSAGES).length).toBe(2);
    expect(isPaymentError(http('BILLING_PAYMENT_BANK_ACCOUNT_REQUIRED'))).toBeFalse();
    expect(isPaymentError(http('BILLING_PAYMENT_BANK_ACCOUNT_INVALID'))).toBeFalse();
    expect(isPaymentError(http('BILLING_PAYMENT_FORM_REQUIRED'))).toBeFalse();
    expect(isPaymentError(http('BILLING_PAYMENT_TERM_INVALID'))).toBeFalse();
  });

  it('usa el mensaje claro del back y, sin él, el de respaldo en español', () => {
    expect(billingErrorMessage(http(PAYMENT_METHOD_REQUIRED_CODE, 'El metodo de pago es obligatorio'))).toBe(
      'El metodo de pago es obligatorio',
    );
    for (const code of Object.keys(PAYMENT_ERROR_MESSAGES)) {
      expect(billingErrorMessage(http(code))).toBe(PAYMENT_ERROR_MESSAGES[code]);
    }
    expect(billingErrorMessage(http(PAYMENT_METHOD_INVALID_CODE))).toContain('método de pago');
  });

  it('paymentApiError arma el mismo 422 que el back (lo usan los mocks)', () => {
    const e = paymentApiError(PAYMENT_METHOD_INVALID_CODE);
    expect(e.status).toBe(422);
    expect(isPaymentError(e)).toBeTrue();
    expect(billingErrorMessage(e)).toContain('método de pago');
  });
});
