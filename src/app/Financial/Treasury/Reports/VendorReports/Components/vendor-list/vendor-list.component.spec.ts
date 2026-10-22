import { fakeAsync, tick } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { VendorListComponent } from './vendor-list.component';
import { VendorSupplierOption } from '../../Services/vendor-report.service';

describe('VendorListComponent filters', () => {
  function component() {
    const vendorReportService = {
      getProveedores: jasmine.createSpy('getProveedores').and.returnValue(of([
        supplier(7, 'PEPSI'),
        supplier(8, 'Proveedor PP8 Local'),
      ])),
      getVendorSummaries: jasmine.createSpy('getVendorSummaries').and.returnValue(of([
        {
          id: 7,
          name: 'PEPSI',
          totalDebits: 100,
          totalCredits: 500,
          currentBalance: 400,
          lastTransactionDate: new Date(2026, 7, 14),
          transactionCount: 2,
        },
      ])),
    };
    const messageService = { add: jasmine.createSpy('add') };
    const exportService = {
      datedFilename: (_prefix: string, ext: string) => `test.${ext}`,
      downloadCsv: jasmine.createSpy('downloadCsv'),
      downloadPdf: jasmine.createSpy('downloadPdf'),
    };
    const value = new VendorListComponent(
      new FormBuilder(),
      vendorReportService as any,
      messageService as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      exportService as any,
    );
    value.ngOnInit();
    return { value, vendorReportService, messageService, exportService };
  }

  function supplier(id: number, name: string): VendorSupplierOption {
    return {
      thId: id,
      entId: 'enterprise-a',
      typeId: {} as any,
      thirdTypes: [],
      personType: 'Juridica' as any,
      idNumber: id,
      state: true,
      address: 'addr',
      phoneNumber: '1',
      email: 'a@b.com',
      displayName: name,
    };
  }

  it('loads proveedores by type for autocomplete', () => {
    const { value, vendorReportService } = component();
    expect(vendorReportService.getProveedores).toHaveBeenCalled();
    expect(value.allSuppliers.length).toBe(2);
  });

  it('filters supplier suggestions case-insensitively by prefix', fakeAsync(() => {
    const { value } = component();
    value.searchSupplier({ query: 'pep' });
    tick(300);
    expect(value.filteredSuppliers.length).toBe(1);
    expect(value.filteredSuppliers[0].displayName).toBe('PEPSI');
  }));

  it('reloads report when supplier is selected', () => {
    const { value, vendorReportService } = component();
    value.supplierSelection = supplier(7, 'PEPSI');
    value.onSupplierFilterChange();
    expect(vendorReportService.getVendorSummaries).toHaveBeenCalledWith(
      jasmine.objectContaining({ supplierId: 7 }),
    );
    expect(value.vendorTableFirst).toBe(0);
  });

  it('reloads report when dates change', () => {
    const { value, vendorReportService } = component();
    value.filterForm.patchValue({
      dateFrom: new Date(2026, 7, 1),
      dateTo: new Date(2026, 7, 31),
    });
    value.onDateFilterChange();
    expect(vendorReportService.getVendorSummaries).toHaveBeenCalledWith(
      jasmine.objectContaining({
        dateFrom: value.filterForm.value.dateFrom,
        dateTo: value.filterForm.value.dateTo,
      }),
    );
  });

  it('blocks invalid date range', () => {
    const { value, vendorReportService, messageService } = component();
    value.filterForm.setValue({
      dateFrom: new Date(2026, 7, 20),
      dateTo: new Date(2026, 7, 1),
    }, { emitEvent: false });
    const callsBefore = vendorReportService.getVendorSummaries.calls.count();
    value.onDateFilterChange();
    expect(messageService.add).toHaveBeenCalled();
    expect(vendorReportService.getVendorSummaries.calls.count()).toBe(callsBefore);
  });

  it('clears filters and reloads all vendors', () => {
    const { value, vendorReportService } = component();
    value.supplierSelection = supplier(7, 'PEPSI');
    value.filterForm.patchValue({
      dateFrom: new Date(2026, 7, 1),
      dateTo: new Date(2026, 7, 31),
    });
    value.clearFilters();
    expect(value.supplierSelection).toBeNull();
    expect(value.filterForm.value.dateFrom).toBeNull();
    const lastFilter = vendorReportService.getVendorSummaries.calls.mostRecent().args[0];
    expect(lastFilter.supplierId).toBeUndefined();
    expect(lastFilter.dateFrom).toBeNull();
    expect(lastFilter.dateTo).toBeNull();
  });

  it('exports filtered vendors to PDF', () => {
    const { value, exportService } = component();
    value.exportToPdf();
    expect(exportService.downloadPdf).toHaveBeenCalled();
    const options = exportService.downloadPdf.calls.mostRecent().args[0];
    expect(options.rows.length).toBe(1);
    expect(options.rows[0][0]).toBe('PEPSI');
  });
});
