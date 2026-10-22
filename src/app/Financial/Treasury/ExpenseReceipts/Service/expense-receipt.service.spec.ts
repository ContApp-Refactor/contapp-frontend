import { firstValueFrom, of } from 'rxjs';

import { ExpenseReceiptService } from './expense-receipt.service';

describe('ExpenseReceiptService payable accounts', () => {
  it('builds unique options from pending obligations', async () => {
    const api = {
      pending: jasmine.createSpy().and.returnValue(of([
        { payableAccountId: 20, payableAccountCode: '2205' },
        { payableAccountId: 20, payableAccountCode: '2205' },
        { payableAccountId: 30, payableAccountCode: '2335' },
      ])),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const skeleton = { getFactureById: jasmine.createSpy() };
    const service = new ExpenseReceiptService(
      api as any,
      null as any,
      null as any,
      null as any,
      null as any,
      storage as any,
      skeleton as any,
    );

    const result = await firstValueFrom(service.getPayableAccounts());

    expect(api.pending).toHaveBeenCalledWith('enterprise-a');
    expect(result).toEqual([
      { id: 20, code: '2205', name: 'Cuenta por pagar', fullName: '2205 - Cuenta por pagar' },
      { id: 30, code: '2335', name: 'Cuenta por pagar', fullName: '2335 - Cuenta por pagar' },
    ]);
  });

  it('maps voucher detail amounts and schedule origin for receipt details', async () => {
    const api = {
      voucher: jasmine.createSpy().and.returnValue(of({
        id: 21,
        voucherNumber: 'CE-A753A051',
        issueDate: '2026-08-14',
        status: 'POSTED',
        paymentMethodId: 1,
        bankAccountId: 33,
        total: 90000,
        accountingEntryId: 40,
        accountingEntryCode: 'AE-PV-21',
        createdAt: '2026-08-14T15:30:00Z',
        updatedAt: '2026-08-14T15:31:00Z',
        details: [{
          supplierId: 7,
          invoiceId: 11,
          invoiceReference: '678151694',
          payableAccountCode: '220501',
          previousBalance: 100000,
          amountPaid: 90000,
          remainingBalance: 0,
        }],
      })),
      schedules: jasmine.createSpy().and.returnValue(of([
        { id: 5, voucherId: 21, executionDate: '2026-08-14', status: 'EXECUTED', details: [] },
      ])),
      payable: jasmine.createSpy().and.returnValue(of({
        id: 11,
        sourceInvoiceId: 501,
        originalAmount: 100000,
        reference: '678151694',
        payableAccountCode: '220501',
      })),
      accountingEntry: jasmine.createSpy().and.returnValue(of({ code: 'AE-PV-21', movements: [] })),
    };
    const paymentMethods = {
      findAll: jasmine.createSpy().and.returnValue(of({
        content: [{ id: 1, name: 'Transferencia', requiresBankAccount: true }],
      })),
    };
    const bankAccounts = {
      findAllActive: jasmine.createSpy().and.returnValue(of({
        content: [{ id: 33, accountNumber: '123456', bank: { name: 'Banco Demo' } }],
      })),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy().and.returnValue(of({
        content: [{ thId: 7, socialReason: 'Proveedor Demo', idNumber: 900123456, verificationNumber: 1 }],
      })),
      getThirdPartie: jasmine.createSpy().and.returnValue(of({
        thId: 7,
        socialReason: 'Proveedor Demo',
        idNumber: 900123456,
        verificationNumber: 1,
      })),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const skeleton = { getFactureById: jasmine.createSpy() };
    const service = new ExpenseReceiptService(
      api as any,
      paymentMethods as any,
      null as any,
      bankAccounts as any,
      thirds as any,
      storage as any,
      skeleton as any,
    );

    const receipt = await firstValueFrom(service.getExpenseReceiptById(21));

    expect(api.payable).toHaveBeenCalledWith(11, 'enterprise-a');
    expect(receipt.grossAmount).toBe(100000);
    expect(receipt.retentionsAmount).toBe(10000);
    expect(receipt.netAmount).toBe(90000);
    expect(receipt.supplierIdentification).toBe('900123456-1');
    expect(receipt.accountingStatusLabel).toBe('Activo');
    expect(receipt.scheduleId).toBe(5);
    expect(receipt.bankAccountLabel).toContain('Banco Demo');
    expect(receipt.details[0].payableAccountCode).toBe('220501');
    expect(receipt.details[0].retentionsApplied).toBe(10000);
    expect(receipt.details[0].sourceInvoiceId).toBe(501);
  });

  it('falls back to voucher total and payable when detail balances are missing', async () => {
    const api = {
      voucher: jasmine.createSpy().and.returnValue(of({
        id: 30,
        voucherNumber: 'CE-C6DEB140',
        issueDate: '2026-08-13',
        status: 'POSTED',
        paymentMethodId: 2,
        total: 1455,
        accountingEntryId: 55,
        accountingEntryCode: 'AE-PV-30',
        updatedAt: '2026-08-13T23:53:00Z',
        details: [{
          supplierId: 78,
          invoiceId: 20,
          invoiceReference: '680688965',
          payableAccountCode: '220501',
          amount: 1455,
        }],
      })),
      schedules: jasmine.createSpy().and.returnValue(of([])),
      payable: jasmine.createSpy().and.returnValue(of({
        id: 20,
        sourceInvoiceId: 880,
        reference: '680688965',
        originalAmount: 2323,
        payableAccountCode: '220501',
      })),
      accountingEntry: jasmine.createSpy().and.returnValue(of({ code: 'AE-PV-30', movements: [] })),
    };
    const paymentMethods = {
      findAll: jasmine.createSpy().and.returnValue(of({
        content: [{ id: 2, name: 'CHECK', requiresBankAccount: false }],
      })),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy().and.returnValue(of({ content: [] })),
      getThirdPartie: jasmine.createSpy().and.returnValue(of({
        thId: 78,
        socialReason: 'Proveedor Real',
        idNumber: 800123456,
        verificationNumber: 4,
      })),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const skeleton = { getFactureById: jasmine.createSpy() };
    const service = new ExpenseReceiptService(
      api as any,
      paymentMethods as any,
      null as any,
      { findAllActive: jasmine.createSpy().and.returnValue(of({ content: [] })) } as any,
      thirds as any,
      storage as any,
      skeleton as any,
    );

    const receipt = await firstValueFrom(service.getExpenseReceiptById(30));

    expect(thirds.getThirdPartie).toHaveBeenCalledWith(78, 'enterprise-a');
    expect(receipt.supplierName).toBe('Proveedor Real');
    expect(receipt.supplierIdentification).toBe('800123456-4');
    expect(receipt.grossAmount).toBe(2323);
    expect(receipt.netAmount).toBe(1455);
    expect(receipt.retentionsAmount).toBe(868);
    expect(receipt.details[0].invoiceValue).toBe(2323);
    expect(receipt.details[0].amountPaid).toBe(1455);
  });

  it('maps void voucher response and polls until void completes', async () => {
    const voidResponses = [
      { id: 53, voucherNumber: 'CE-C6DEB140', status: 'VOIDING', paymentMethodId: 1, issueDate: '2026-08-13', total: 1455, details: [] },
      { id: 53, voucherNumber: 'CE-C6DEB140', status: 'VOIDED', paymentMethodId: 1, issueDate: '2026-08-13', total: 1455, details: [] },
    ];
    let voucherCalls = 0;
    const api = {
      voidVoucher: jasmine.createSpy().and.returnValue(of(voidResponses[0])),
      voucher: jasmine.createSpy().and.callFake(() => of(voidResponses[Math.min(voucherCalls++, 1)])),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const skeleton = { getFactureById: jasmine.createSpy() };
    const service = new ExpenseReceiptService(
      api as any,
      null as any,
      null as any,
      null as any,
      null as any,
      storage as any,
      skeleton as any,
    );

    const response = await firstValueFrom(service.voidExpenseReceipt(53, 'Motivo de prueba'));

    expect(api.voidVoucher).toHaveBeenCalledWith(53, 'enterprise-a', 'Motivo de prueba');
    expect(response.receiptCode).toBe('CE-C6DEB140');
    expect(response.status).toBe('VOIDED');
  });

  it('loads paid invoice product lines from billing skeleton detail', async () => {
    const skeleton = {
      getFactureById: jasmine.createSpy().and.returnValue(of({
        products: [{
          productId: 9,
          amount: 1,
          unitPrice: 80000,
          subtotal: 80000,
          discount: 0,
          description: 'Mantenimiento',
          taxPercentage: [19],
        }],
      })),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const service = new ExpenseReceiptService(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      storage as any,
      skeleton as any,
    );

    const lines = await firstValueFrom(service.getPaidInvoiceProductLines(501));

    expect(skeleton.getFactureById).toHaveBeenCalledWith(501);
    expect(lines.length).toBe(1);
    expect(lines[0].productLabel).toBe('Mantenimiento');
    expect(lines[0].lineTotal).toBe(95200);
  });

  it('resolves the canonical billing invoice from the treasury obligation', async () => {
    const api = {
      payable: jasmine.createSpy().and.returnValue(of({
        id: 11,
        sourceInvoiceId: 501,
      })),
    };
    const skeleton = {
      getFactureById: jasmine.createSpy().and.returnValue(of({ products: [] })),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const service = new ExpenseReceiptService(
      api as any,
      null as any,
      null as any,
      null as any,
      null as any,
      storage as any,
      skeleton as any,
    );

    const result = await firstValueFrom(service.getPaidInvoiceProductLinesForObligation(11));

    expect(api.payable).toHaveBeenCalledWith(11, 'enterprise-a');
    expect(skeleton.getFactureById).toHaveBeenCalledWith(501);
    expect(skeleton.getFactureById).not.toHaveBeenCalledWith(11);
    expect(result).toEqual({ sourceInvoiceId: 501, lines: [] });
  });
});
