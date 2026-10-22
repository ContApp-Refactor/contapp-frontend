import { fakeAsync, tick } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { VendorReport, VendorReportTransaction } from '../../Models/VendorReport';
import { VendorReportComponent } from './vendor-report.component';

describe('VendorReportComponent document status filter', () => {
  function transaction(
    documentStatus: string,
    reference: string,
    date = new Date(2026, 7, 10),
  ): VendorReportTransaction {
    return {
      date,
      reference,
      type: 'Bill',
      description: reference,
      debits: 0,
      credits: 100,
      balance: 100,
      documentStatus,
      voided: documentStatus === 'VOIDED',
    };
  }

  function componentWith(transactions: VendorReportTransaction[]): VendorReportComponent {
    const component = Object.create(VendorReportComponent.prototype) as VendorReportComponent;
    component.vendorReport = {
      vendor: { id: 4, name: 'Libardo Pantoja' },
      dateRange: { startDate: new Date(2026, 7, 1), endDate: new Date(2026, 7, 31) },
      transactions,
      periodTotals: {
        openingBalance: 0,
        periodPayments: 0,
        totalDebits: 0,
        totalCredits: 0,
        writeOffTotal: 0,
        netBalance: 0,
      },
      totalDue: 0,
      agingReport: {
        prePaid: 0,
        current: 0,
        days0to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
        total: 0,
      },
    } satisfies VendorReport;
    component.visibleTransactions = [];
    return component;
  }

  function interactiveComponent(transactions: VendorReportTransaction[] = rows) {
    const report = componentWith(transactions).vendorReport!;
    const service = jasmine.createSpyObj('VendorReportService', [
      'getVendorReport',
      'getInvoiceOptions',
      'exportToPdf',
    ]);
    service.getVendorReport.and.returnValue(of(report));
    service.getInvoiceOptions.and.returnValue(of([]));
    service.exportToPdf.and.returnValue(new Blob(['pdf'], { type: 'application/pdf' }));
    const exportService = jasmine.createSpyObj('TreasuryExportService', [
      'triggerBrowserDownload',
      'downloadCsv',
      'formatDate',
    ]);
    exportService.formatDate.and.callFake((value: Date) => value.toISOString());
    const messageService = jasmine.createSpyObj('MessageService', ['add']);
    const component = new VendorReportComponent(
      new FormBuilder(),
      {} as any,
      jasmine.createSpyObj('Router', ['navigate']),
      service,
      messageService,
      exportService,
    );
    component.vendorId = 4;
    component.vendorName = 'Libardo Pantoja';
    component.initializeDateRangeForm();
    component.vendorReport = report;
    component.visibleTransactions = [...transactions];
    return { component, service, exportService };
  }

  const rows = [
    transaction('POSTED', 'FC-POSTED'),
    transaction('VOIDED', 'FC-VOIDED'),
    transaction('DRAFT', 'FC-DRAFT'),
  ];

  it('shows every row when no status is selected', () => {
    const component = componentWith(rows);

    component.applyDocumentStatusFilter('');

    expect(component.visibleTransactions).toEqual(rows);
    expect(component.visibleTransactions).not.toBe(rows);
  });

  it('shows only POSTED documents for Contabilizado', () => {
    const component = componentWith(rows);

    component.applyDocumentStatusFilter('POSTED');

    expect(component.visibleTransactions.map((row) => row.reference)).toEqual(['FC-POSTED']);
  });

  it('shows only VOIDED documents for Anulado', () => {
    const component = componentWith(rows);

    component.applyDocumentStatusFilter('VOIDED');

    expect(component.visibleTransactions.map((row) => row.reference)).toEqual(['FC-VOIDED']);
  });

  it('supports DRAFT when that canonical state is present in the report', () => {
    const component = componentWith(rows);

    component.applyDocumentStatusFilter('DRAFT');

    expect(component.visibleTransactions.map((row) => row.reference)).toEqual(['FC-DRAFT']);
  });

  it('restores the complete source collection when the status is cleared', () => {
    const component = componentWith(rows);
    component.applyDocumentStatusFilter('VOIDED');

    component.applyDocumentStatusFilter(null);

    expect(component.visibleTransactions).toEqual(rows);
    expect(component.vendorReport?.transactions).toEqual(rows);
  });

  it('combines status with the rows already constrained by date and invoice filters', () => {
    const dateAndInvoiceRows = rows.filter(
      (row) => row.date >= new Date(2026, 7, 1)
        && row.date <= new Date(2026, 7, 31)
        && row.reference === 'FC-VOIDED',
    );
    const component = componentWith(dateAndInvoiceRows);

    component.applyDocumentStatusFilter('VOIDED');

    expect(component.visibleTransactions.map((row) => row.reference)).toEqual(['FC-VOIDED']);
  });

  it('returns an empty collection for a status that is not present', () => {
    const component = componentWith(rows);

    component.applyDocumentStatusFilter('NOT_A_STATUS');

    expect(component.visibleTransactions).toEqual([]);
  });

  it('identifies a voided invoice with text and not only color', () => {
    const component = componentWith(rows);

    expect(component.getTransactionTypeTag('Bill', true)).toEqual({
      severity: 'danger',
      text: 'Factura (Anulada)',
    });
  });

  it('filters status immediately without requesting the backend', () => {
    const { component, service } = interactiveComponent();

    component.dateRangeForm.get('status')!.setValue('VOIDED');

    expect(component.visibleTransactions.map((row) => row.reference)).toEqual(['FC-VOIDED']);
    expect(service.getVendorReport).not.toHaveBeenCalled();
  });

  it('does not request while either date is missing or the range is invalid', fakeAsync(() => {
    const { component, service } = interactiveComponent();

    component.dateRangeForm.get('startDate')!.setValue(null);
    tick(400);
    component.dateRangeForm.patchValue(
      { startDate: new Date(2026, 7, 31), endDate: new Date(2026, 7, 1) },
      { emitEvent: true },
    );
    tick(400);

    expect(service.getVendorReport).not.toHaveBeenCalled();
  }));

  it('requests automatically when the complete date range is valid', fakeAsync(() => {
    const { component, service } = interactiveComponent();
    component.dateRangeForm.patchValue(
      { startDate: new Date(2026, 7, 1), endDate: new Date(2026, 7, 31) },
      { emitEvent: false },
    );

    component.dateRangeForm.get('endDate')!.setValue(new Date(2026, 7, 30));
    tick(399);
    expect(service.getVendorReport).not.toHaveBeenCalled();
    tick(1);

    expect(service.getVendorReport).toHaveBeenCalledTimes(1);
  }));

  it('debounces rapid invoice or text filter changes', fakeAsync(() => {
    const { component, service } = interactiveComponent();

    component.dateRangeForm.get('invoice')!.setValue('F');
    tick(200);
    component.dateRangeForm.get('invoice')!.setValue('FC');
    tick(399);
    expect(service.getVendorReport).not.toHaveBeenCalled();
    tick(1);

    expect(service.getVendorReport).toHaveBeenCalledTimes(1);
    expect(service.getVendorReport.calls.mostRecent().args[3]).toBe('FC');
  }));

  it('combines the backend invoice filter with the local status filter', fakeAsync(() => {
    const { component, service } = interactiveComponent();

    component.dateRangeForm.get('status')!.setValue('VOIDED');
    component.dateRangeForm.get('invoice')!.setValue('FC-VOIDED');
    tick(400);

    expect(service.getVendorReport).toHaveBeenCalledTimes(1);
    expect(component.visibleTransactions.map((row) => row.reference)).toEqual(['FC-VOIDED']);
  }));

  it('clears every filter, restores all rows and performs only one request', fakeAsync(() => {
    const { component, service } = interactiveComponent();
    component.dateRangeForm.get('status')!.setValue('VOIDED');
    component.dateRangeForm.get('invoice')!.setValue('FC-VOIDED');

    component.clearFilters();
    tick(400);

    expect(component.dateRangeForm.get('status')!.value).toBe('');
    expect(component.dateRangeForm.get('invoice')!.value).toBeNull();
    expect(component.visibleTransactions).toEqual(rows);
    expect(service.getVendorReport).toHaveBeenCalledTimes(1);
  }));

  it('coalesces multiple backend filter changes into one request', fakeAsync(() => {
    const { component, service } = interactiveComponent();

    component.dateRangeForm.get('startDate')!.setValue(new Date(2026, 7, 1));
    component.dateRangeForm.get('endDate')!.setValue(new Date(2026, 7, 31));
    component.dateRangeForm.get('invoice')!.setValue('FC-VOIDED');
    tick(400);

    expect(service.getVendorReport).toHaveBeenCalledTimes(1);
  }));

  it('exports exactly the currently visible transactions', () => {
    const { component, service, exportService } = interactiveComponent();
    component.dateRangeForm.get('status')!.setValue('VOIDED');

    component.exportToPdf();

    const exportedReport = service.exportToPdf.calls.mostRecent().args[0] as VendorReport;
    expect(exportedReport.transactions.map((row) => row.reference)).toEqual(['FC-VOIDED']);
    expect(exportService.triggerBrowserDownload).toHaveBeenCalled();
  });

  it('keeps CSV export aligned with the currently visible transactions', () => {
    const { component, exportService } = interactiveComponent();
    component.dateRangeForm.get('status')!.setValue('VOIDED');

    component.exportToCsv();

    const csv = exportService.downloadCsv.calls.mostRecent().args[0];
    expect(csv.rows.length).toBe(1);
    expect(csv.rows[0][2]).toBe('FC-VOIDED');
  });
});
