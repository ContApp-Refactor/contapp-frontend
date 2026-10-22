import {
  educationalDescription,
  exportSuccessDetail,
  payableStatusLabel,
  scheduleStatusLabel,
  translatePaymentMethodName,
  voucherStatusLabel,
} from './treasury-status-labels';

describe('treasury-status-labels', () => {
  it('maps voucher statuses to Spanish labels', () => {
    expect(voucherStatusLabel('DRAFT')).toBe('Borrador');
    expect(voucherStatusLabel('POSTED')).toBe('Contabilizado');
    expect(voucherStatusLabel('VOIDED')).toBe('Anulado');
    expect(voucherStatusLabel('FAILED')).toBe('Fallido');
    expect(voucherStatusLabel('UNKNOWN')).toBe('Desconocido');
  });

  it('maps schedule statuses to Spanish labels', () => {
    expect(scheduleStatusLabel('EXECUTED')).toBe('Ejecutado');
    expect(scheduleStatusLabel('WAITING_ACCOUNTING')).toBe('Esperando contabilización');
    expect(scheduleStatusLabel('FAILED')).toBe('Fallido');
  });

  it('maps payable statuses including partial payment', () => {
    expect(payableStatusLabel('PARTIALLY_PAID')).toBe('Abono parcial');
  });

  it('translates payment method codes and common English names', () => {
    expect(translatePaymentMethodName('CASH')).toBe('Efectivo');
    expect(translatePaymentMethodName('BANK_TRANSFER')).toBe('Transferencia bancaria');
    expect(translatePaymentMethodName('CHECK')).toBe('Cheque');
    expect(translatePaymentMethodName('CREDIT_CARD')).toBe('Tarjeta');
  });

  it('translates lab observation patterns', () => {
    expect(educationalDescription('VOID case')).toBe('Anulación de comprobante');
    expect(educationalDescription('Bank transfer')).toBe('Transferencia bancaria');
    expect(educationalDescription('Part abono')).toBe('Abono parcial');
    expect(educationalDescription('Full cash')).toBe('Pago total en efectivo');
    expect(educationalDescription('Multi invoice')).toBe('Pago múltiple');
  });

  it('builds export success messages in Spanish', () => {
    expect(exportSuccessDetail('operaciones', 'pdf')).toContain('PDF');
    expect(exportSuccessDetail('operaciones', 'csv')).toContain('CSV');
  });
});
