import { fakeAsync, tick } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { TreasuryOperationsComponent } from './treasury-operations.component';
import {
  WRITE_OFF_AMOUNT_EXCEEDS_MESSAGE,
  WRITE_OFF_AMOUNT_INVALID_MESSAGE,
  WRITE_OFF_COUNTERPART_REQUIRED_MESSAGE,
  WRITE_OFF_CREATE_SUCCESS_MESSAGE,
  WRITE_OFF_NO_AVAILABLE_BALANCE_MESSAGE,
  WRITE_OFF_PENDING_BLOCK_MESSAGE,
  WRITE_OFF_POST_FAILED_MESSAGE,
  WRITE_OFF_POSTED_PARTIAL_MESSAGE,
  WRITE_OFF_POSTED_TOTAL_MESSAGE,
  WRITE_OFF_REASON_REQUIRED_MESSAGE,
  WRITE_OFF_DISCARD_SUCCESS_MESSAGE,
  WRITE_OFF_VOIDED_MESSAGE,
  WRITE_OFF_VOID_FAILED_MESSAGE,
} from '../Shared/treasury-writeoff-messages';

describe('TreasuryOperationsComponent PP8', () => {
  function component(enterpriseId = 'enterprise-a') {
    const api = {
      createVoucher: jasmine.createSpy('createVoucher').and.returnValue(NEVER),
      createSchedule: jasmine.createSpy('createSchedule').and.returnValue(NEVER),
      createWriteOff: jasmine.createSpy('createWriteOff').and.returnValue(NEVER),
      confirmWriteOff: jasmine.createSpy('confirmWriteOff').and.returnValue(NEVER),
      discardWriteOff: jasmine.createSpy('discardWriteOff').and.returnValue(NEVER),
      voidWriteOff: jasmine.createSpy('voidWriteOff').and.returnValue(NEVER),
      changeDueDate: jasmine.createSpy('changeDueDate').and.returnValue(of({})),
      pending: jasmine.createSpy('pending').and.returnValue(of([])),
      payable: jasmine.createSpy('payable').and.returnValue(of(null)),
      vouchers: jasmine.createSpy('vouchers').and.returnValue(of({ content: [] })),
      schedules: jasmine.createSpy('schedules').and.returnValue(of([])),
      cancelSchedule: jasmine.createSpy('cancelSchedule').and.returnValue(NEVER),
      writeOffs: jasmine.createSpy('writeOffs').and.returnValue(of([])),
      writeOff: jasmine.createSpy('writeOff').and.returnValue(of({ id: 1, status: 'POSTED', total: 100 })),
      accountingEntry: jasmine.createSpy('accountingEntry').and.returnValue(of({ code: 'AE-PWO-12', movements: [] })),
    };
    const storage = {
      getIdEnterprise: jasmine.createSpy('getIdEnterprise').and.returnValue(enterpriseId),
    };
    const exportService = {
      datedFilename: (_prefix: string, ext: string) => `test.${ext}`,
      downloadCsvSections: jasmine.createSpy('downloadCsvSections'),
      downloadPdfSections: jasmine.createSpy('downloadPdfSections'),
    };
    const messageService = { add: jasmine.createSpy('add') };
    const paymentMethods = {
      findAllActive: jasmine.createSpy('findAllActive').and.returnValue(of({ content: [] })),
    };
    const chart = {
      getListAuxiliaryAccounts: jasmine.createSpy('getListAuxiliaryAccounts').and.returnValue(of([])),
      getListAccounts: jasmine.createSpy('getListAccounts').and.returnValue(of([])),
    };
    const bankAccountsService = {
      findAllActive: jasmine.createSpy('findAllActive').and.returnValue(of({ content: [] })),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy('getThirdParties').and.returnValue(of({ content: [] })),
    };
    const expenseReceiptService = {
      getSuppliers: jasmine.createSpy('getSuppliers').and.returnValue(of([])),
    };
    const router = { navigate: jasmine.createSpy('navigate') };
    const value = new TreasuryOperationsComponent(
      api as any,
      storage as any,
      paymentMethods as any,
      chart as any,
      bankAccountsService as any,
      thirds as any,
      exportService as any,
      messageService as any,
      expenseReceiptService as any,
      router as any,
    );
    value.payables = [{
      id: 11, sourceInvoiceId: 50, reference: 'FC-50', enterpriseId: 'enterprise-a', supplierId: 7,
      originalAmount: 100, paidAmount: 0, pendingAmount: 100, reservedAmount: 0, availableAmount: 100,
      issueDate: '2026-08-01', originalDueDate: '2026-08-30', dueDate: '2026-08-30',
      payableAccountId: 2205, payableAccountCode: '2205', active: true, version: 0
    }];
    value.minExecutionDate = new Date();
    value.minExecutionDate.setHours(0, 0, 0, 0);
    value.minExecutionDate.setDate(value.minExecutionDate.getDate() + 1);
    value.methods = [{ id: 1, requiresBankAccount: true, accountingAccountId: 10 }];
    value.methodOptions = [{ id: 1, label: 'Transferencia' }];
    value.bankOptions = [{ id: 33, label: 'Banco - 123' }];
    value.accounts = [
      { id: 100, code: '519999', description: 'Gasto', status: true },
      { id: 4295, code: '429501', description: 'Ingresos diversos', status: true },
      { id: 2205, code: '220501', description: 'CxP proveedores', status: true },
    ];
    value.accountOptions = value.accounts.map((account: any) => ({
      id: account.id,
      label: `${account.code} - ${account.description}`,
    }));
    (value as any).supplierNames = new Map<number, string>([[7, 'Proveedor Demo']]);
    return {
      value,
      api,
      storage,
      paymentMethods,
      chart,
      bankAccountsService,
      thirds,
      expenseReceiptService,
    };
  }

  function payable(overrides: Partial<any> = {}) {
    return {
      id: 11,
      sourceInvoiceId: 50,
      reference: 'FC-50',
      enterpriseId: 'enterprise-a',
      supplierId: 7,
      originalAmount: 500,
      paidAmount: 0,
      pendingAmount: 500,
      reservedAmount: 0,
      availableAmount: 500,
      issueDate: '2026-08-01',
      originalDueDate: '2026-08-30',
      dueDate: '2026-08-30',
      payableAccountId: 2205,
      payableAccountCode: '220501',
      active: true,
      version: 0,
      ...overrides,
    };
  }

  it('loads Treasury data from successful API responses', () => {
    const { value, api } = component();
    const expectedPayable = payable({ id: 91 });
    const expectedVoucher = { id: 12, voucherNumber: 'CE-12', status: 'DRAFT', details: [] };
    api.pending.and.returnValue(of([expectedPayable]));
    api.vouchers.and.returnValue(of({ content: [expectedVoucher] }));

    value.reload();

    expect(value.payables).toEqual([expectedPayable]);
    expect(value.allVouchers).toEqual([expectedVoucher] as any);
    expect(value.vouchers).toEqual([expectedVoucher] as any);
    expect(value.loaded).toBeTrue();
    expect(value.loading).toBeFalse();
    expect(value.loadError).toBe('');
  });

  it('treats a successful empty response as a legitimate empty state', () => {
    const { value } = component();

    value.reload();

    expect(value.payables).toEqual([]);
    expect(value.vouchers).toEqual([]);
    expect(value.schedules).toEqual([]);
    expect(value.writeOffs).toEqual([]);
    expect(value.loaded).toBeTrue();
    expect(value.loadError).toBe('');
  });

  it('exposes a load error instead of presenting a first-load HTTP failure as empty data', () => {
    const { value, api } = component();
    value.payables = [];
    api.pending.and.returnValue(throwError(() => ({ status: 500 })));

    value.reload();

    expect(value.loaded).toBeFalse();
    expect(value.loading).toBeFalse();
    expect(value.loadError).toBe('No fue posible cargar la información de Tesorería.');
  });

  it('keeps the last valid data when a later reload fails', () => {
    const { value, api } = component();
    const lastValidPayables = [payable({ id: 77 })];
    api.pending.and.returnValue(of(lastValidPayables));
    value.reload();
    expect(value.loaded).toBeTrue();

    api.pending.and.returnValue(throwError(() => ({ status: 500 })));
    value.reload();

    expect(value.payables).toEqual(lastValidPayables);
    expect(value.loaded).toBeTrue();
    expect(value.loadError).toBe('No fue posible cargar la información de Tesorería.');
  });

  it('reads the active enterprise again on every reload', () => {
    const { value, api, storage } = component();
    storage.getIdEnterprise.and.returnValues('enterprise-a', 'enterprise-b');

    value.reload();
    value.reload();

    expect(api.pending.calls.allArgs()).toEqual([
      ['enterprise-a'],
      ['enterprise-b'],
    ]);
    expect(api.vouchers.calls.allArgs()).toEqual([
      ['enterprise-a', { size: 1000 }],
      ['enterprise-b', { size: 1000 }],
    ]);
  });

  it('does not call Treasury APIs when there is no active enterprise', () => {
    const { value, api, paymentMethods, chart, bankAccountsService, thirds } = component('');

    value.reload();

    expect(api.pending).not.toHaveBeenCalled();
    expect(api.vouchers).not.toHaveBeenCalled();
    expect(api.schedules).not.toHaveBeenCalled();
    expect(api.writeOffs).not.toHaveBeenCalled();
    expect(paymentMethods.findAllActive).not.toHaveBeenCalled();
    expect(bankAccountsService.findAllActive).not.toHaveBeenCalled();
    expect(chart.getListAuxiliaryAccounts).not.toHaveBeenCalled();
    expect(chart.getListAccounts).not.toHaveBeenCalled();
    expect(thirds.getThirdParties).not.toHaveBeenCalled();
    expect(value.loaded).toBeFalse();
    expect(value.loadError).toBe('Seleccione una empresa activa.');
  });

  it('blocks payment dialog when no active payment methods are available', () => {
    const { value } = component();
    value.allPaymentMethodsCount = 0;
    value.methodOptions = [];
    const messageService = (value as any).messageService;
    value.openPaymentDialog(value.payables[0]);
    expect(value.paymentDialogVisible).toBeFalse();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      summary: 'Métodos de pago',
      detail: jasmine.stringMatching(/Métodos de Pago/),
    }));
  });

  it('explains inactive accounting accounts when payment methods are filtered out', () => {
    const { value } = component();
    value.allPaymentMethodsCount = 2;
    value.methodOptions = [];
    const messageService = (value as any).messageService;
    value.openPaymentDialog(value.payables[0]);
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: jasmine.stringMatching(/cuenta contable activa/),
    }));
  });

  it('blocks payment when method requires bank but no bank accounts are available', () => {
    const { value } = component();
    value.bankOptions = [];
    value.openPaymentDialog(value.payables[0]);
    value.dialogPaymentMethodId = 1;
    value.confirmPayFromDialog();
    const messageService = (value as any).messageService;
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: 'No hay cuentas bancarias activas para este método. Configure cuentas bancarias en Maestros Generales → Banco y Cuentas Bancarias.',
    }));
  });

  it('does not create draft from dialog when bank account is required but missing', () => {
    const { value, api } = component();
    value.openPaymentDialog(value.payables[0]);
    value.dialogLines[0].paymentMode = 'partial';
    value.dialogLines[0].amount = 25;
    value.dialogPaymentMethodId = 1;
    value.confirmCreateFromDialog();
    expect(api.createVoucher).not.toHaveBeenCalled();
    expect((value as any).messageService.add).toHaveBeenCalled();
  });

  it('blocks payment when selected method is no longer selectable', () => {
    const { value, api } = component();
    value.openPaymentDialog(value.payables[0]);
    value.dialogLines[0].paymentMode = 'partial';
    value.dialogLines[0].amount = 25;
    value.dialogPaymentMethodId = 99;
    value.dialogBankAccountId = 33;
    value.confirmPayFromDialog();
    expect(api.createVoucher).not.toHaveBeenCalled();
    expect((value as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: 'El método de pago seleccionado ya no está disponible.',
    }));
  });

  it('blocks draft creation when selected method is no longer selectable', () => {
    const { value, api } = component();
    value.openPaymentDialog(value.payables[0]);
    value.dialogLines[0].paymentMode = 'partial';
    value.dialogLines[0].amount = 25;
    value.dialogPaymentMethodId = 99;
    value.dialogBankAccountId = 33;
    value.confirmCreateFromDialog();
    expect(api.createVoucher).not.toHaveBeenCalled();
    expect((value as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: 'El método de pago seleccionado ya no está disponible.',
    }));
  });

  it('creates draft from dialog when payment rules are satisfied', () => {
    const { value, api } = component();
    api.createVoucher.and.returnValue(of({
      id: 1,
      voucherNumber: 'CE-1',
      status: 'DRAFT',
      enterpriseId: 'enterprise-a',
      paymentMethodId: 1,
      total: 25,
      version: 0,
      details: [],
    }));
    value.openPaymentDialog(value.payables[0]);
    value.dialogLines[0].paymentMode = 'partial';
    value.dialogLines[0].amount = 25;
    value.dialogPaymentMethodId = 1;
    value.dialogBankAccountId = 33;
    value.confirmCreateFromDialog();
    expect(api.createVoucher).toHaveBeenCalledWith(jasmine.objectContaining({
      enterpriseId: 'enterprise-a',
      paymentMethodId: 1,
      bankAccountId: 33,
      details: [{ supplierId: 7, invoiceId: 11, amount: 25 }],
    }));
  });

  it('builds write-off options only with active accounts', () => {
    const { value } = component();
    const allAccounts = [
      { id: 1, code: '111', description: 'Activa', status: true },
      { id: 2, code: '222', description: 'Inactiva', status: false },
    ] as any[];
    value.accounts = allAccounts.filter((account) => account.status !== false);
    value.accountOptions = value.accounts.map((account: any) => ({
      id: account.id,
      label: `${account.code} - ${account.description}`,
    }));
    expect(value.accountOptions.map((option) => option.id)).toEqual([1]);
  });

  it('exports operations to csv when data is available', () => {
    const { value } = component();
    const exportService = (value as any).exportService;
    value.schedules = [{
      id: 1,
      executionDate: '2026-08-20',
      status: 'SCHEDULED',
      total: 25,
      retryCount: 0,
      paymentMethodId: 1,
      enterpriseId: 'enterprise-a',
      details: [],
    }];
    value.exportToCsv();
    expect(exportService.downloadCsvSections).toHaveBeenCalled();
  });

  it('rejects due dates on or before today in the change dialog', () => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const payable = value.payables[0];

    value.openDueDateDialog(payable);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    value.onDueDatePickerChange(today);

    expect(value.newDueDate?.toDateString()).toBe(value.minDueDate.toDateString());
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      severity: 'warn',
      summary: 'Vencimiento inválido',
    }));
    expect(api.changeDueDate).not.toHaveBeenCalled();
  });

  it('submits due date change with reason through the API', () => {
    const { value, api } = component();
    const payable = value.payables[0];

    value.openDueDateDialog(payable);
    const nextDueDate = new Date(value.minDueDate);
    nextDueDate.setDate(nextDueDate.getDate() + 5);
    value.newDueDate = nextDueDate;
    value.dueDateReason = 'Acuerdo con proveedor';
    value.confirmDueDateChange();

    expect(api.changeDueDate).toHaveBeenCalledWith(
      payable.id,
      'enterprise-a',
      (value as any).formatIsoDate(nextDueDate),
      'Acuerdo con proveedor',
    );
  });

  it('labels pay button for partial vs total payment', () => {
    const { value } = component();
    value.openPaymentDialog(value.payables[0]);
    expect(value.dialogPayButtonLabel).toBe('Pagar total');

    value.setDialogLinePaymentMode(value.dialogLines[0], 'partial');
    value.dialogLines[0].amount = 25;
    expect(value.dialogPayButtonLabel).toBe('Pagar parcialmente');
  });

  it('schedules payment from dialog when date is provided', () => {
    const { value, api } = component();
    api.createSchedule.and.returnValue(of({
      id: 3,
      executionDate: '2026-08-20',
      total: 25,
      status: 'SCHEDULED',
      enterpriseId: 'enterprise-a',
      paymentMethodId: 1,
      retryCount: 0,
      version: 0,
      details: [{ supplierId: 7, invoiceId: 11, amount: 25 }],
    }));
    value.openScheduleDialog(value.payables[0]);
    value.scheduleLines[0].paymentMode = 'partial';
    value.scheduleLines[0].amount = 25;
    value.schedulePaymentMethodId = 1;
    value.scheduleBankAccountId = 33;
    value.scheduleExecutionDate = new Date(value.minExecutionDate);
    value.confirmScheduleFromDialog();
    expect(api.createSchedule).toHaveBeenCalled();
    expect(api.createVoucher).not.toHaveBeenCalled();
  });

  it('rejects schedule submission when execution date is today', () => {
    const { value, api } = component();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    value.openScheduleDialog(value.payables[0]);
    value.scheduleLines[0].amount = 25;
    value.schedulePaymentMethodId = 1;
    value.scheduleBankAccountId = 33;
    value.scheduleExecutionDate = today;
    value.confirmScheduleFromDialog();
    expect(api.createSchedule).not.toHaveBeenCalled();
  });

  it('rejects schedule submission when execution date is in the past', () => {
    const { value, api } = component();
    const yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);
    value.openScheduleDialog(value.payables[0]);
    value.scheduleLines[0].amount = 25;
    value.schedulePaymentMethodId = 1;
    value.scheduleBankAccountId = 33;
    value.scheduleExecutionDate = yesterday;
    value.confirmScheduleFromDialog();
    expect(api.createSchedule).not.toHaveBeenCalled();
  });

  it('rejects a scheduled amount of zero before calling the API', () => {
    const { value, api } = component();
    value.openScheduleDialog(value.payables[0]);
    value.scheduleLines[0].amount = 0;
    value.schedulePaymentMethodId = 1;
    value.scheduleBankAccountId = 33;
    value.scheduleExecutionDate = new Date(value.minExecutionDate);

    value.confirmScheduleFromDialog();

    expect(api.createSchedule).not.toHaveBeenCalled();
    expect((value as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      summary: 'Monto inválido',
    }));
  });

  it('rejects a scheduled amount above the available balance before calling the API', () => {
    const { value, api } = component();
    value.openScheduleDialog(value.payables[0]);
    value.scheduleLines[0].amount = 100.01;
    value.schedulePaymentMethodId = 1;
    value.scheduleBankAccountId = 33;
    value.scheduleExecutionDate = new Date(value.minExecutionDate);

    value.confirmScheduleFromDialog();

    expect(api.createSchedule).not.toHaveBeenCalled();
    expect((value as any).messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      summary: 'Saldo insuficiente',
    }));
  });

  it('uses deschedule terminology and calls the existing cancellation contract', () => {
    const { value, api } = component();
    const schedule = { id: 5 } as any;

    value.deschedule(schedule);

    expect(api.cancelSchedule).toHaveBeenCalledWith(5);
  });

  it('disables pay write-off and schedule actions when payable has active schedule', () => {
    const { value, api } = component();
    const target = payable({ id: 11, availableAmount: 100, pendingAmount: 100 });
    value.schedules = [{
      id: 1,
      executionDate: '2026-08-20',
      status: 'SCHEDULED',
      total: 50,
      retryCount: 0,
      paymentMethodId: 1,
      enterpriseId: 'enterprise-a',
      details: [{ supplierId: 7, invoiceId: 11, amount: 50 }],
    }];
    expect(value.hasActivePaymentScheduleForPayable(target)).toBeTrue();
    expect(value.canWriteOffPayable(target)).toBeFalse();
    value.openPaymentDialog(target);
    expect(value.paymentDialogVisible).toBeFalse();
    value.openScheduleDialog(target);
    expect(value.scheduleDialogVisible).toBeFalse();
    expect(api.createSchedule).not.toHaveBeenCalled();
  });

  it('enables write-off action when payable has available balance', () => {
    const { value } = component();
    expect(value.canWriteOffPayable(value.payables[0])).toBeTrue();
  });

  it('disables write-off action when payable has zero available balance', () => {
    const { value } = component();
    const zeroBalance = payable({ availableAmount: 0, pendingAmount: 0 });
    expect(value.canWriteOffPayable(zeroBalance)).toBeFalse();
  });

  it('disables write-off when obligation has active DRAFT write-off', () => {
    const { value } = component();
    const target = payable({ id: 11, availableAmount: 279, pendingAmount: 279 });
    value.writeOffs = [{
      id: 4,
      status: 'DRAFT',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeFalse();
    expect(value.writeOffPayableTooltip(target)).toBe(WRITE_OFF_PENDING_BLOCK_MESSAGE);
  });

  it('disables write-off when obligation has POSTING write-off', () => {
    const { value } = component();
    const target = payable({ id: 11, availableAmount: 279, pendingAmount: 279 });
    value.writeOffs = [{
      id: 5,
      status: 'POSTING',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeFalse();
  });

  it('re-enables write-off after VOIDED draft on same obligation', () => {
    const { value } = component();
    const target = payable({ id: 11, availableAmount: 279, pendingAmount: 279 });
    value.writeOffs = [{
      id: 6,
      status: 'VOIDED',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeTrue();
  });

  it('re-enables write-off after POSTED partial write-off when balance remains', () => {
    const { value } = component();
    const target = payable({ id: 11, availableAmount: 179, pendingAmount: 179 });
    value.writeOffs = [{
      id: 7,
      status: 'POSTED',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeTrue();
  });

  it('re-enables write-off after FAILED write-off when balance available', () => {
    const { value } = component();
    const target = payable({ id: 11, availableAmount: 279, pendingAmount: 279 });
    value.writeOffs = [{
      id: 8,
      status: 'FAILED',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeTrue();
  });

  it('blocks opening dialog when active write-off exists', () => {
    const { value } = component();
    const messageService = (value as any).messageService;
    const target = payable({ id: 11, availableAmount: 279 });
    value.writeOffs = [{
      id: 9,
      status: 'DRAFT',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    value.openWriteOffDialog(target);
    expect(value.writeOffDialogVisible).toBeFalse();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_PENDING_BLOCK_MESSAGE,
    }));
  });

  it('keeps write-off disabled after reload when DRAFT exists', () => {
    const { value } = component();
    const target = payable({ id: 11, availableAmount: 279 });
    value.writeOffs = [{
      id: 10,
      status: 'DRAFT',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeFalse();
  });

  it('opens write-off dialog with obligation context and readonly labels', () => {
    const { value } = component();
    const target = payable({ availableAmount: 500, pendingAmount: 500, originalAmount: 500 });
    value.openWriteOffDialog(target);
    expect(value.writeOffDialogVisible).toBeTrue();
    expect(value.writeOffTarget).toEqual(target);
    expect(value.writeOffAmount).toBe(500);
    expect(value.payableAccountLabel(target)).toBe('220501 - CxP proveedores');
    expect(value.supplierName(target.supplierId)).toBe('Proveedor Demo');
  });

  it('warns when opening write-off dialog without available balance', () => {
    const { value } = component();
    const messageService = (value as any).messageService;
    const target = payable({ availableAmount: 0, pendingAmount: 0 });
    value.openWriteOffDialog(target);
    expect(value.writeOffDialogVisible).toBeFalse();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_NO_AVAILABLE_BALANCE_MESSAGE,
    }));
  });

  it('creates partial write-off with supplier invoice and amount in request', () => {
    const { value, api } = component();
    api.createWriteOff.and.returnValue(of({ id: 9, status: 'DRAFT', total: 200 }));
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 200;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Condonación parcial';
    value.confirmWriteOffFromDialog();
    expect(api.createWriteOff).toHaveBeenCalledWith(jasmine.objectContaining({
      enterpriseId: 'enterprise-a',
      reason: 'Condonación parcial',
      counterpartAccountId: 4295,
      counterpartAccountCode: '429501',
      details: [{ supplierId: 7, invoiceId: 11, amount: 200 }],
    }));
    expect(value.writeOffDialogVisible).toBeFalse();
  });

  it('creates total write-off when amount equals available balance', () => {
    const { value, api } = component();
    api.createWriteOff.and.returnValue(of({ id: 10, status: 'DRAFT', total: 500 }));
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 500;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Condonación total';
    value.confirmWriteOffFromDialog();
    expect(api.createWriteOff).toHaveBeenCalledWith(jasmine.objectContaining({
      details: [{ supplierId: 7, invoiceId: 11, amount: 500 }],
    }));
  });

  it('blocks write-off when amount exceeds available balance', () => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 600;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Exceso';
    value.confirmWriteOffFromDialog();
    expect(api.createWriteOff).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_AMOUNT_EXCEEDS_MESSAGE,
    }));
  });

  it('blocks write-off when amount is zero', () => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 0;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Cero';
    value.confirmWriteOffFromDialog();
    expect(api.createWriteOff).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_AMOUNT_INVALID_MESSAGE,
    }));
  });

  it('requires counterpart account before creating write-off', () => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 100;
    value.writeOffReason = 'Sin contrapartida';
    value.confirmWriteOffFromDialog();
    expect(api.createWriteOff).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_COUNTERPART_REQUIRED_MESSAGE,
    }));
  });

  it('requires reason before creating write-off', () => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 100;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = '   ';
    value.confirmWriteOffFromDialog();
    expect(api.createWriteOff).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_REASON_REQUIRED_MESSAGE,
    }));
  });

  it('does not send payable account in write-off request payload', () => {
    const { value, api } = component();
    api.createWriteOff.and.returnValue(of({ id: 11, status: 'DRAFT', total: 100 }));
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 100;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Motivo';
    value.confirmWriteOffFromDialog();
    const payload = api.createWriteOff.calls.mostRecent().args[0];
    expect(payload.payableAccountId).toBeUndefined();
    expect(payload.payableAccountCode).toBeUndefined();
    expect(payload.details[0].payableAccountId).toBeUndefined();
    expect(payload.details[0].payableAccountCode).toBeUndefined();
  });

  it('shows success message and reloads write-offs after creation', fakeAsync(() => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    api.createWriteOff.and.returnValue(of({ id: 12, status: 'DRAFT', total: 100, reason: 'Motivo' }));
    api.writeOffs.and.returnValue(of([{ id: 12, status: 'DRAFT', total: 100, reason: 'Motivo' }]));
    const target = payable();
    value.openWriteOffDialog(target);
    value.writeOffAmount = 100;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Motivo';
    value.confirmWriteOffFromDialog();
    tick();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_CREATE_SUCCESS_MESSAGE,
    }));
    expect(api.writeOffs).toHaveBeenCalledWith('enterprise-a');
    expect(value.writeOffs.some((item) => item.id === 12)).toBeTrue();
  }));

  it('keeps payable visible after creating DRAFT write-off reload', fakeAsync(() => {
    const { value, api } = component();
    const target = payable({ availableAmount: 279, pendingAmount: 279 });
    value.payables = [target];
    api.createWriteOff.and.returnValue(of({ id: 13, status: 'DRAFT', total: 100 }));
    api.writeOffs.and.returnValue(of([{ id: 13, status: 'DRAFT', total: 100 }]));
    api.pending.and.returnValue(of([target]));
    value.openWriteOffDialog(target);
    value.writeOffAmount = 100;
    value.writeOffCounterpartAccountId = 4295;
    value.writeOffReason = 'Parcial';
    value.confirmWriteOffFromDialog();
    tick();
    expect(value.payables.some((item) => item.id === target.id)).toBeTrue();
    expect(value.payables[0].availableAmount).toBe(279);
  }));

  it('shows partial success message when obligation remains after posting write-off', fakeAsync(() => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable({ id: 11, availableAmount: 179, pendingAmount: 179 });
    api.confirmWriteOff.and.returnValue(of({ id: 20, status: 'POSTING', total: 100, details: [{ invoiceId: 11, supplierId: 7, amount: 100 }] }));
    api.writeOff.and.returnValue(of({ id: 20, status: 'POSTED', total: 100, details: [{ invoiceId: 11, supplierId: 7, amount: 100 }] }));
    api.pending.and.returnValue(of([target]));
    api.writeOffs.and.returnValue(of([{ id: 20, status: 'POSTED', total: 100 }]));
    value.confirmWriteOff({ id: 20, status: 'DRAFT', total: 100, details: [{ invoiceId: 11, supplierId: 7, amount: 100 }] });
    tick();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_POSTED_PARTIAL_MESSAGE,
    }));
    expect(value.payables.some((item) => item.id === 11)).toBeTrue();
  }));

  it('shows total success message and removes payable when balance reaches zero', fakeAsync(() => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable({ id: 11, availableAmount: 179, pendingAmount: 179 });
    value.payables = [target];
    api.confirmWriteOff.and.returnValue(of({ id: 21, status: 'POSTING', total: 179, details: [{ invoiceId: 11, supplierId: 7, amount: 179 }] }));
    api.writeOff.and.returnValue(of({ id: 21, status: 'POSTED', total: 179, details: [{ invoiceId: 11, supplierId: 7, amount: 179 }] }));
    api.pending.and.returnValue(of([]));
    api.writeOffs.and.returnValue(of([{ id: 21, status: 'POSTED', total: 179 }]));
    value.confirmWriteOff({ id: 21, status: 'DRAFT', total: 179, details: [{ invoiceId: 11, supplierId: 7, amount: 179 }] });
    tick();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_POSTED_TOTAL_MESSAGE,
    }));
    expect(value.payables.length).toBe(0);
  }));

  it('shows failure message when write-off posting is rejected', fakeAsync(() => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable();
    value.payables = [target];
    api.confirmWriteOff.and.returnValue(of({ id: 22, status: 'POSTING', total: 100, details: [{ invoiceId: 11, supplierId: 7, amount: 100 }] }));
    api.writeOff.and.returnValue(of({ id: 22, status: 'FAILED', total: 100, details: [{ invoiceId: 11, supplierId: 7, amount: 100 }] }));
    api.pending.and.returnValue(of([target]));
    api.writeOffs.and.returnValue(of([{ id: 22, status: 'FAILED', total: 100 }]));
    value.confirmWriteOff({ id: 22, status: 'DRAFT', total: 100, details: [{ invoiceId: 11, supplierId: 7, amount: 100 }] });
    tick();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_POST_FAILED_MESSAGE,
    }));
    expect(value.payables[0].availableAmount).toBe(500);
  }));

  it('discard draft shows modal and discards without changing payables', fakeAsync(() => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    const target = payable();
    value.payables = [target];
    const draft = { id: 23, status: 'DRAFT', total: 100 };
    api.discardWriteOff.and.returnValue(of({ id: 23, status: 'VOIDED', total: 100 }));
    api.writeOffs.and.returnValue(of([{ id: 23, status: 'VOIDED', total: 100 }]));
    api.pending.and.returnValue(of([target]));
    value.discardDraftWriteOff(draft);
    expect(value.writeOffDiscardDialogVisible).toBeTrue();
    value.confirmDiscardWriteOff();
    tick();
    expect(api.discardWriteOff).toHaveBeenCalledWith(23);
    expect(api.voidWriteOff).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_DISCARD_SUCCESS_MESSAGE,
    }));
    expect(value.payables[0].availableAmount).toBe(500);
  }));

  it('cancel discard modal does not call API', () => {
    const { value, api } = component();
    value.discardDraftWriteOff({ id: 23, status: 'DRAFT', total: 100 });
    expect(value.writeOffDiscardDialogVisible).toBeTrue();
    value.cancelDiscardWriteOffDialog();
    expect(value.writeOffDiscardDialogVisible).toBeFalse();
    expect(api.discardWriteOff).not.toHaveBeenCalled();
    expect(api.voidWriteOff).not.toHaveBeenCalled();
  });

  it('voidWriteOff polls until VOIDED and refreshes list without page reload', fakeAsync(() => {
    const { value, api } = component();
    const messageService = (value as any).messageService;
    api.voidWriteOff.and.returnValue(of({ id: 30, status: 'VOIDING', total: 100 }));
    api.writeOff.and.returnValues(
      of({ id: 30, status: 'VOIDING', total: 100 }),
      of({ id: 30, status: 'VOIDED', total: 100 }),
    );
    api.writeOffs.and.returnValue(of([{ id: 30, status: 'VOIDED', total: 100 }]));
    api.pending.and.returnValue(of([]));
    value.voidWriteOff({ id: 30, status: 'POSTED', total: 100 });
    tick(2000);
    tick(2000);
    expect(api.voidWriteOff).toHaveBeenCalledWith(30);
    expect(api.discardWriteOff).not.toHaveBeenCalled();
    expect(value.writeOffs[0].status).toBe('VOIDED');
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({
      detail: WRITE_OFF_VOIDED_MESSAGE,
    }));
  }));

  it('re-enables write-off button after discarding draft write-off', fakeAsync(() => {
    const { value, api } = component();
    const target = payable({ id: 11, availableAmount: 279, pendingAmount: 279 });
    value.payables = [target];
    value.writeOffs = [{
      id: 31,
      status: 'DRAFT',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    }];
    expect(value.canWriteOffPayable(target)).toBeFalse();
    const draft = {
      id: 31,
      status: 'DRAFT',
      total: 100,
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    };
    api.discardWriteOff.and.returnValue(of({ id: 31, status: 'VOIDED', total: 100 }));
    api.writeOffs.and.returnValue(of([{ id: 31, status: 'VOIDED', total: 100 }]));
    api.pending.and.returnValue(of([target]));
    value.discardDraftWriteOff(draft);
    value.confirmDiscardWriteOff();
    tick();
    expect(value.canWriteOffPayable(target)).toBeTrue();
  }));

  it('disables write-off action when available balance is zero', () => {
    const { value } = component();
    expect(value.canWriteOffPayable(payable({ availableAmount: 0, pendingAmount: 0 }))).toBeFalse();
  });

  it('shows accounting entry code from API in voucher table label', () => {
    const { value } = component();
    const label = value.voucherAccountingEntryLabel({
      id: 1,
      voucherNumber: 'CE-FB04BD89',
      enterpriseId: 'enterprise-a',
      issueDate: '2026-08-14',
      status: 'POSTED',
      paymentMethodId: 1,
      total: 22323,
      accountingEntryId: 37,
      accountingEntryCode: 'AE-PV-42',
      version: 0,
      details: [],
    });
    expect(label).toBe('AE-PV-42');
  });

  it('shows em dash when voucher has no accounting entry code', () => {
    const { value } = component();
    const label = value.voucherAccountingEntryLabel({
      id: 1,
      voucherNumber: 'CE-FB04BD89',
      enterpriseId: 'enterprise-a',
      issueDate: '2026-08-14',
      status: 'DRAFT',
      paymentMethodId: 1,
      total: 22323,
      version: 0,
      details: [],
    });
    expect(label).toBe('—');
  });

  it('keeps internal accounting entry id on voucher model for actions', () => {
    const { value } = component();
    const voucher = {
      id: 1,
      voucherNumber: 'CE-FB04BD89',
      enterpriseId: 'enterprise-a',
      issueDate: '2026-08-14',
      status: 'POSTED' as const,
      paymentMethodId: 1,
      total: 22323,
      accountingEntryId: 37,
      accountingEntryCode: 'AE-PV-42',
      version: 0,
      details: [],
    };
    value.vouchers = [voucher];
    expect(value.vouchers[0].accountingEntryId).toBe(37);
    expect(value.voucherAccountingEntryLabel(voucher)).not.toContain('37');
  });

  it('uses contextual help content for treasury operations', () => {
    const { value } = component();
    expect(value.help.title).toBe('Operaciones de Tesorería');
    expect(value.help.summary).toContain('Pagar');
    expect(value.help.summary).toContain('Programar');
    expect(value.help.summary).toContain('Baja CxP');
  });

  function sampleVoucher(overrides: Partial<any> = {}) {
    return {
      id: 1,
      voucherNumber: 'CE-FB04BD89',
      enterpriseId: 'enterprise-a',
      issueDate: '2026-08-14',
      status: 'POSTED' as const,
      paymentMethodId: 1,
      total: 500,
      version: 0,
      details: [{ supplierId: 7, invoiceId: 11, amount: 500 }],
      ...overrides,
    };
  }

  function sampleSupplier(id = 7, name = 'PEPSI') {
    return {
      id,
      name,
      accountsPayableAccount: { id: 2205, code: '2205', name: '2205' },
    };
  }

  it('filters vouchers locally by number with debounce', fakeAsync(() => {
    const { value } = component();
    value.allVouchers = [
      sampleVoucher(),
      sampleVoucher({ id: 2, voucherNumber: 'CE-AB12CD34', status: 'DRAFT' }),
    ] as any;
    value.applyVoucherFilters();
    (value as any).setupVoucherFilterSubscriptions();
    value.onVoucherNumberFilterChange('FB04');
    tick(299);
    expect(value.vouchers.length).toBe(2);
    tick(1);
    expect(value.vouchers.length).toBe(1);
    expect(value.vouchers[0].voucherNumber).toBe('CE-FB04BD89');
    expect(value.voucherTableFirst).toBe(0);
  }));

  it('filters vouchers immediately by status', () => {
    const { value } = component();
    value.allVouchers = [
      sampleVoucher(),
      sampleVoucher({ id: 2, voucherNumber: 'CE-AB12CD34', status: 'DRAFT' }),
    ] as any;
    value.voucherStatusFilter = 'DRAFT';
    value.onVoucherStatusFilterChange();
    expect(value.vouchers.length).toBe(1);
    expect(value.vouchers[0].status).toBe('DRAFT');
    expect(value.voucherTableFirst).toBe(0);
  });

  it('filters vouchers immediately by supplier', () => {
    const { value } = component();
    value.allVouchers = [
      sampleVoucher(),
      sampleVoucher({
        id: 2,
        voucherNumber: 'CE-AB12CD34',
        details: [{ supplierId: 8, invoiceId: 12, amount: 200 }],
      }),
    ] as any;
    value.voucherSupplierFilter = sampleSupplier();
    value.onVoucherSupplierFilterChange();
    expect(value.vouchers.length).toBe(1);
    expect(value.vouchers[0].id).toBe(1);
  });

  it('combines voucher filters', () => {
    const { value } = component();
    value.allVouchers = [
      sampleVoucher(),
      sampleVoucher({ id: 2, voucherNumber: 'CE-FB99EE00', status: 'POSTED', details: [{ supplierId: 7, invoiceId: 13, amount: 100 }] }),
      sampleVoucher({ id: 3, voucherNumber: 'CE-AB12CD34', status: 'DRAFT', details: [{ supplierId: 7, invoiceId: 14, amount: 200 }] }),
    ] as any;
    value.voucherNumberFilter = 'FB';
    value.voucherStatusFilter = 'POSTED';
    value.voucherSupplierFilter = sampleSupplier();
    value.applyVoucherFilters();
    expect(value.vouchers.map((item) => item.id)).toEqual([1, 2]);
  });

  it('clears voucher filters reactively', () => {
    const { value } = component();
    value.allVouchers = [
      sampleVoucher(),
      sampleVoucher({ id: 2, voucherNumber: 'CE-AB12CD34', status: 'DRAFT' }),
    ] as any;
    value.voucherNumberFilter = 'AB12';
    value.voucherStatusFilter = 'DRAFT';
    value.voucherSupplierFilter = sampleSupplier();
    value.voucherDateFrom = new Date(2026, 7, 1);
    value.voucherDateTo = new Date(2026, 7, 31);
    value.applyVoucherFilters();
    expect(value.vouchers.length).toBe(1);
    value.clearVoucherFilters();
    expect(value.vouchers.length).toBe(2);
    expect(value.voucherNumberFilter).toBe('');
    expect(value.voucherStatusFilter).toBe('');
    expect(value.voucherSupplierFilter).toBeNull();
  });

  it('searches voucher suppliers through expense receipt service', () => {
    const { value, expenseReceiptService } = component();
    expenseReceiptService.getSuppliers.and.returnValue(of([
      sampleSupplier(7, 'PEPSI'),
      sampleSupplier(8, 'Papelería Central'),
    ]));
    value.searchVoucherSupplier({ query: 'Pep' });
    expect(expenseReceiptService.getSuppliers).toHaveBeenCalledWith('pep');
    expect(value.filteredVoucherSuppliers).toEqual([sampleSupplier(7, 'PEPSI')]);
  });

  function sampleWriteOff(overrides: Partial<any> = {}) {
    return {
      id: 12,
      enterpriseId: 'enterprise-a',
      reason: 'Condonación',
      counterpartAccountId: 4295,
      counterpartAccountCode: '429501',
      total: 87360,
      status: 'POSTED' as const,
      accountingEntryId: 37,
      accountingEntryCode: 'AE-PWO-12',
      createdAt: '2026-08-14T10:00:00Z',
      version: 0,
      details: [{
        supplierId: 7,
        invoiceId: 11,
        invoiceReference: '678151694',
        payableAccountId: 2205,
        payableAccountCode: '220501',
        amount: 87360,
      }],
      ...overrides,
    };
  }

  it('formats write-off table labels from API and catalog data', () => {
    const { value } = component();
    const item = sampleWriteOff();
    expect(value.writeOffNumberLabel(item)).toBe('12');
    expect(value.writeOffDateLabel(item)).toBe('14/08/2026');
    expect(value.writeOffSupplierLabel(item)).toBe('Proveedor Demo');
    expect(value.writeOffInvoiceReference(item)).toBe('678151694');
    expect(value.writeOffCounterpartLabel(item)).toBe('429501 - Ingresos diversos');
    expect(value.writeOffAccountingEntryLabel(item)).toBe('AE-PWO-12');
    expect(value.writeOffSupplierLabel(item)).not.toContain('7');
    expect(value.writeOffInvoiceReference(item)).not.toContain('11');
  });

  it('falls back to payable reference when invoiceReference is missing', () => {
    const { value } = component();
    const item = sampleWriteOff({
      details: [{ supplierId: 7, invoiceId: 11, amount: 100 }],
    });
    expect(value.writeOffInvoiceReference(item)).toBe('FC-50');
  });

  it('shows fallback supplier label when third is not in catalogue', () => {
    const { value } = component();
    const item = sampleWriteOff({
      details: [{ supplierId: 99, invoiceId: 11, invoiceReference: '678151694', amount: 100 }],
    });
    expect(value.writeOffSupplierLabel(item)).toBe('Proveedor 99');
  });

  it('formats write-off balances from API detail fields', () => {
    const { value } = component();
    const item = sampleWriteOff({
      details: [{
        supplierId: 7,
        invoiceId: 11,
        invoiceReference: '678151694',
        amount: 100,
        originalAmount: 5000,
        availableAmount: 3000,
      }],
    });
    expect(value.writeOffOriginalBalanceLabel(item)).toBe('$ 5.000');
    expect(value.writeOffAvailableBalanceLabel(item)).toBe('$ 3.000');
  });

  it('exposes write-off actions according to status', () => {
    const { value } = component();
    const draft = sampleWriteOff({ status: 'DRAFT', accountingEntryId: undefined, accountingEntryCode: undefined });
    expect(value.canPostWriteOff(draft)).toBeTrue();
    expect(value.canDiscardWriteOff(draft)).toBeTrue();
    expect(value.canVoidWriteOff(draft)).toBeFalse();
    expect(value.canShowWriteOffAccounting(draft)).toBeFalse();

    const posted = sampleWriteOff({ status: 'POSTED' });
    expect(value.canPostWriteOff(posted)).toBeFalse();
    expect(value.canDiscardWriteOff(posted)).toBeFalse();
    expect(value.canVoidWriteOff(posted)).toBeTrue();
    expect(value.canShowWriteOffAccounting(posted)).toBeTrue();

    const voided = sampleWriteOff({ status: 'VOIDED' });
    expect(value.canVoidWriteOff(voided)).toBeFalse();
    expect(value.canShowWriteOffAccounting(voided)).toBeTrue();
  });

  it('loads write-off accounting entry with PAYABLE_WRITEOFF source type', () => {
    const { value, api } = component();
    const item = sampleWriteOff();
    value.showWriteOffAccounting(item);
    expect(api.accountingEntry).toHaveBeenCalledWith(12, 'PAYABLE_WRITEOFF');
  });

  it('opens write-off detail dialog and refreshes detail from API', () => {
    const { value, api } = component();
    const item = sampleWriteOff({ status: 'DRAFT', accountingEntryId: undefined });
    const refreshed = sampleWriteOff({
      status: 'DRAFT',
      accountingEntryId: undefined,
      details: [{
        supplierId: 7,
        invoiceId: 11,
        invoiceReference: '678151694',
        amount: 87360,
        originalAmount: 5000,
        availableAmount: 3000,
      }],
    });
    api.writeOff.and.returnValue(of(refreshed));
    value.showWriteOffDetail(item);
    expect(value.writeOffDetailDialogVisible).toBeTrue();
    expect(api.writeOff).toHaveBeenCalledWith(12);
    expect(value.writeOffDetailTarget?.details?.[0]?.originalAmount).toBe(5000);
  });
});
