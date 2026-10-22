import { ExpenseReceiptCreationComponent } from './expense-receipt-creation.component';

describe('ExpenseReceiptCreationComponent payment validation', () => {
  function component() {
    const value = Object.create(ExpenseReceiptCreationComponent.prototype) as ExpenseReceiptCreationComponent;
    value.selectedInvoices = [{ id: 1 }];
    value.requiresBankAccount = false;
    value.expenseReceiptForm = {
      get: (name: string) => ({
        valid: true,
        value: name === 'bankAccountId' ? null : 'ok',
      }),
    } as any;
    return value;
  }

  it('rejects submission when bank account is set but method does not require it', () => {
    const value = component();
    value.expenseReceiptForm.get = ((name: string) => ({
      valid: true,
      value: name === 'bankAccountId' ? 10 : 'ok',
    })) as any;
    expect(value.isFormValidForSubmission()).toBeFalse();
  });

  it('accepts submission when bank is omitted for non-bank methods', () => {
    const value = component();
    expect(value.isFormValidForSubmission()).toBeTrue();
  });

  it('requires bank account when method demands it', () => {
    const value = component();
    value.requiresBankAccount = true;
    value.expenseReceiptForm.get = ((name: string) => ({
      valid: name !== 'bankAccountId',
      value: null,
    })) as any;
    expect(value.isFormValidForSubmission()).toBeFalse();
  });
});
