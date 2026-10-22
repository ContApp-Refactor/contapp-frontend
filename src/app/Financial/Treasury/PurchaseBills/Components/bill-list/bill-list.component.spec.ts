import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { PaymentSchedule } from '../../../Shared/treasury-api.models';
import { BillListComponent } from './bill-list.component';

describe('BillListComponent schedules', () => {
  beforeEach(() => {
    spyOn(LocalStorageMethods.prototype, 'getIdEnterprise').and.returnValue('enterprise-a');
  });
  function component() {
    const api = {
      schedules: jasmine.createSpy('schedules').and.returnValue(of([])),
      pending: jasmine.createSpy('pending').and.returnValue(of([])),
      cancelSchedule: jasmine.createSpy('cancelSchedule'),
      retrySchedule: jasmine.createSpy('retrySchedule'),
    };
    const paymentMethods = {
      findAllActive: jasmine.createSpy('findAllActive').and.returnValue(of({ content: [] })),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy('getThirdParties').and.returnValue(of({ content: [] })),
    };
    const messageService = { add: jasmine.createSpy('add') };
    const exportService = {
      datedFilename: (_prefix: string, ext: string) => `test.${ext}`,
      downloadCsv: jasmine.createSpy('downloadCsv'),
      downloadPdf: jasmine.createSpy('downloadPdf'),
    };
    const bankAccounts = {
      findAllActive: jasmine.createSpy('findAllActive').and.returnValue(of({ content: [] })),
    };
    const router = { navigate: jasmine.createSpy('navigate') };
    const route = { snapshot: { queryParamMap: { get: () => null } }, queryParamMap: of({ get: () => null }) };
    const value = new BillListComponent(
      new FormBuilder(),
      api as any,
      paymentMethods as any,
      thirds as any,
      bankAccounts as any,
      messageService as any,
      exportService as any,
      router as any,
      route as any,
    );
    value.ngOnInit();
    return { value, api, messageService };
  }

  function sampleSchedule(status: PaymentSchedule['status'] = 'SCHEDULED'): PaymentSchedule {
    return {
      id: 10,
      enterpriseId: 'enterprise-a',
      executionDate: '2026-08-20',
      status,
      paymentMethodId: 1,
      retryCount: 0,
      details: [{ supplierId: 7, invoiceId: 11, amount: 500 }],
    };
  }

  it('loads schedules instead of purchase bills', () => {
    const { api } = component();
    expect(api.schedules).toHaveBeenCalledWith('enterprise-a');
    expect(api.pending).toHaveBeenCalledWith('enterprise-a');
  });

  it('filters schedules by status', () => {
    const { value } = component();
    value.allSchedules = [sampleSchedule('SCHEDULED'), sampleSchedule('FAILED')];
    value.filteredSchedules = [...value.allSchedules];
    value.filterForm.patchValue({ status: 'FAILED' });
    value.applyFilters();
    expect(value.filteredSchedules.length).toBe(1);
    expect(value.filteredSchedules[0].status).toBe('FAILED');
  });

  it('calls cancelSchedule for scheduled items', () => {
    const { value, api } = component();
    api.cancelSchedule.and.returnValue(of(sampleSchedule('CANCELED')));
    value.cancelSchedule(sampleSchedule());
    expect(api.cancelSchedule).toHaveBeenCalledWith(10);
  });

  it('calls retrySchedule for failed items', () => {
    const { value, api } = component();
    api.retrySchedule.and.returnValue(of(sampleSchedule('PROCESSING')));
    value.retrySchedule(sampleSchedule('FAILED'));
    expect(api.retrySchedule).toHaveBeenCalledWith(10);
  });

  it('uses contextual help content for payment schedules', () => {
    const { value } = component();
    expect(value.help.title).toBe('Programación de Pagos');
    expect(value.help.summary).toContain('Operaciones de Tesorería');
  });
});
