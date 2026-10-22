import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { ExpenseReceiptsListComponent } from './expense-receipts-list.component';
import { ExpenseReceiptView } from '../../Model/Models';

describe('ExpenseReceiptsListComponent filters', () => {
  function component() {
    const expenseReceiptService = {
      getAllExpenseReceipts: jasmine.createSpy('getAllExpenseReceipts').and.returnValue(of([])),
      getAccountingEntryView: jasmine.createSpy('getAccountingEntryView'),
    };
    const messageService = { add: jasmine.createSpy('add') };
    const exportService = {
      datedFilename: (_prefix: string, ext: string) => `test.${ext}`,
      downloadCsv: jasmine.createSpy('downloadCsv'),
      downloadPdf: jasmine.createSpy('downloadPdf'),
    };
    const value = new ExpenseReceiptsListComponent(
      new FormBuilder(),
      { navigate: jasmine.createSpy('navigate') } as any,
      expenseReceiptService as any,
      messageService as any,
      exportService as any,
    );
    value.initializeForm();
    value.allReceipts = sampleReceipts();
    value.filteredReceipts = [...value.allReceipts];
    return { value, exportService };
  }

  function sampleReceipts(): ExpenseReceiptView[] {
    return [
      {
        id: 1,
        receiptCode: 'CE-FB04BD89',
        issueDate: new Date(2026, 7, 1),
        thirdPartyId: 7,
        supplierName: 'Proveedor A',
        status: 'Contabilizado',
        statusKey: 'POSTED',
        totalAmount: 500,
      },
      {
        id: 2,
        receiptCode: 'CE-AB12CD34',
        issueDate: new Date(2026, 7, 15),
        thirdPartyId: 8,
        supplierName: 'Proveedor B',
        status: 'Borrador',
        statusKey: 'DRAFT',
        totalAmount: 200,
      },
      {
        id: 3,
        receiptCode: 'CE-FB99EE00',
        issueDate: new Date(2026, 6, 20),
        thirdPartyId: 7,
        supplierName: 'Proveedor A',
        status: 'Anulado',
        statusKey: 'VOIDED',
        totalAmount: 100,
      },
    ];
  }

  it('shows all receipts when no filters are applied', () => {
    const { value } = component();
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(3);
  });

  it('filters by supplier', () => {
    const { value } = component();
    value.filterForm.patchValue({ supplierId: 7 });
    value.applyFilters();
    expect(value.filteredReceipts.map((r) => r.id)).toEqual([1, 3]);
  });

  it('filters by status', () => {
    const { value } = component();
    value.filterForm.patchValue({ status: 'DRAFT' });
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(1);
    expect(value.filteredReceipts[0].receiptCode).toBe('CE-AB12CD34');
  });

  it('filters by date range', () => {
    const { value } = component();
    value.filterForm.patchValue({
      startDate: new Date(2026, 7, 10),
      endDate: new Date(2026, 7, 20),
    });
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(1);
    expect(value.filteredReceipts[0].id).toBe(2);
  });

  it('filters by partial receipt code', () => {
    const { value } = component();
    value.filterForm.patchValue({ receiptCode: 'FB04' });
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(1);
    expect(value.filteredReceipts[0].receiptCode).toBe('CE-FB04BD89');
  });

  it('filters by full receipt code', () => {
    const { value } = component();
    value.filterForm.patchValue({ receiptCode: 'CE-AB12CD34' });
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(1);
  });

  it('combines supplier, status and code filters', () => {
    const { value } = component();
    value.filterForm.patchValue({
      supplierId: 7,
      status: 'POSTED',
      receiptCode: 'FB04',
    });
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(1);
    expect(value.filteredReceipts[0].receiptCode).toBe('CE-FB04BD89');
  });

  it('clears all filters and restores full list', () => {
    const { value } = component();
    value.filterForm.patchValue({
      supplierId: 8,
      status: 'DRAFT',
      receiptCode: 'AB12',
      startDate: new Date(2026, 7, 1),
      endDate: new Date(2026, 7, 31),
    });
    value.applyFilters();
    expect(value.filteredReceipts.length).toBe(1);
    value.clearFilters();
    expect(value.filterForm.value).toEqual(jasmine.objectContaining({
      supplierId: null,
      receiptCode: '',
      startDate: null,
      endDate: null,
      status: '',
    }));
    expect(value.filteredReceipts.length).toBe(3);
  });

  it('exports filtered receipts to CSV without amount filters', () => {
    const { value, exportService } = component();
    value.filterForm.patchValue({ receiptCode: 'FB' });
    value.applyFilters();
    value.exportToCsv();
    expect(exportService.downloadCsv).toHaveBeenCalled();
    const options = exportService.downloadCsv.calls.mostRecent().args[0];
    expect(options.rows.length).toBe(2);
  });

  it('exports filtered receipts to PDF', () => {
    const { value, exportService } = component();
    value.filterForm.patchValue({ status: 'DRAFT' });
    value.applyFilters();
    value.exportToPdf();
    expect(exportService.downloadPdf).toHaveBeenCalled();
    const options = exportService.downloadPdf.calls.mostRecent().args[0];
    expect(options.rows.length).toBe(1);
  });

  it('uses contextual help content for expense receipts consultation', () => {
    const { value } = component();
    expect(value.help.title).toBe('Comprobantes de Egreso');
    expect(value.help.summary).toContain('Consulte y gestione');
    expect(value.help.summary).not.toContain('efectuar pagos');
  });
});
