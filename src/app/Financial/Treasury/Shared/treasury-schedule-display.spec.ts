import { PaymentSchedule } from './treasury-api.models';
import { scheduleActiveDetails, scheduleActiveTotal, scheduleInvoicesLabel, scheduleTotal } from './treasury-schedule-display';

describe('treasury-schedule-display', () => {
  const schedule: PaymentSchedule = {
    id: 1,
    enterpriseId: 'ent',
    executionDate: '2026-08-20',
    status: 'SCHEDULED',
    paymentMethodId: 1,
    retryCount: 0,
    details: [
      { supplierId: 10, invoiceId: 11, amount: 100000, canceled: true },
      { supplierId: 20, invoiceId: 12, amount: 200000 },
    ],
  };

  it('keeps original total while excluding canceled details from active total', () => {
    expect(scheduleTotal(schedule)).toBe(300000);
    expect(scheduleActiveTotal(schedule)).toBe(200000);
    expect(scheduleActiveDetails(schedule).length).toBe(1);
  });

  it('marks canceled invoice lines in schedule label', () => {
    const label = scheduleInvoicesLabel(
      schedule,
      new Map([[11, 'FC-A'], [12, 'FC-B']]),
      (amount) => `$${amount}`,
    );
    expect(label).toContain('FC-A ($100000) · cancelado');
    expect(label).toContain('FC-B ($200000)');
    expect(label).not.toContain('FC-B ($200000) · cancelado');
  });
});
