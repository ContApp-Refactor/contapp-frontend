import { of } from 'rxjs';
import { AgingReportService } from './aging-report.service';

describe('AgingReportService filter options', () => {
  it('labels accounts by PUC code and documents by supplier name', (done) => {
    const api = {
      pending: jasmine.createSpy('pending').and.returnValue(
        of([
          {
            supplierId: 7,
            reference: 'FC-100',
            payableAccountCode: '220501',
          },
        ]),
      ),
    };
    const accounts = {
      getListAuxiliaryAccounts: jasmine.createSpy('getListAuxiliaryAccounts').and.returnValue(
        of([{ id: 55, code: '220501', description: 'Proveedores nacionales', status: true }]),
      ),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy('getThirdParties').and.returnValue(
        of({ content: [{ thId: 7, socialReason: 'Acme Ltda.' }] }),
      ),
    };
    const service = new AgingReportService(api as any, accounts as any, thirds as any);

    service.getFilterOptions('ent-1').subscribe((options) => {
      expect(options.accounts[0].label).toBe('220501 - Proveedores nacionales');
      expect(options.documents[0].label).toBe('FC-100 · Acme Ltda.');
      expect(options.suppliers[0].name).toBe('Acme Ltda.');
      done();
    });
  });
});

describe('AgingReportService report lines', () => {
  function createService(agingItems: unknown[]) {
    const api = {
      aging: jasmine.createSpy('aging').and.returnValue(of(agingItems)),
    };
    const accounts = {
      getListAuxiliaryAccounts: jasmine.createSpy('getListAuxiliaryAccounts').and.returnValue(
        of([{ id: 55, code: '220501', description: 'Proveedores nacionales', status: true }]),
      ),
    };
    const thirds = {
      getThirdParties: jasmine.createSpy('getThirdParties').and.returnValue(
        of({ content: [{ thId: 7, socialReason: 'Acme Ltda.' }] }),
      ),
    };
    return {
      service: new AgingReportService(api as any, accounts as any, thirds as any),
      api,
    };
  }

  it('resolves account description using account code from aging API', (done) => {
    const { service } = createService([
      {
        invoiceId: 1,
        supplierId: 7,
        reference: 'FC-100',
        accountCode: '220501',
        dueDate: '2026-08-01',
        daysOverdue: 5,
        current: 100,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
      },
    ]);

    service.getAgingReport('ent-1', { cutoffDate: new Date(2026, 7, 13), includeDocuments: true }).subscribe((report) => {
      expect(report.lines[0].accountDescription).toBe('220501 - Proveedores nacionales');
      done();
    });
  });

  it('requests all suppliers when supplier filter is empty', (done) => {
    const { service, api } = createService([]);
    service.getAgingReport('ent-1', { cutoffDate: new Date(2026, 7, 13) }).subscribe((report) => {
      expect(api.aging).toHaveBeenCalledWith('ent-1', '2026-08-13', undefined, undefined, undefined);
      expect(report.supplierName).toBe('Todos los proveedores');
      done();
    });
  });

  it('requests a specific supplier when supplier filter is set', (done) => {
    const { service, api } = createService([]);
    service.getAgingReport('ent-1', {
      supplierId: 7,
      supplierName: 'Acme Ltda.',
      cutoffDate: new Date(2026, 7, 13),
    }).subscribe((report) => {
      expect(api.aging).toHaveBeenCalledWith('ent-1', '2026-08-13', 7, undefined, undefined);
      expect(report.supplierName).toBe('Acme Ltda.');
      done();
    });
  });

  it('filters aging lines client-side when API returns mixed suppliers', (done) => {
    const { service } = createService([
      {
        invoiceId: 1,
        supplierId: 7,
        reference: 'FC-100',
        accountCode: '220501',
        dueDate: '2026-08-01',
        daysOverdue: 5,
        current: 100,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
      },
      {
        invoiceId: 2,
        supplierId: 9,
        reference: 'FC-200',
        accountCode: '220501',
        dueDate: '2026-08-02',
        daysOverdue: 4,
        current: 50,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
      },
    ]);

    service.getAgingReport('ent-1', {
      supplierId: 7,
      cutoffDate: new Date(2026, 7, 13),
    }).subscribe((report) => {
      expect(report.lines.length).toBe(1);
      expect(report.lines[0].supplierId).toBe(7);
      expect(report.totals.totalDue).toBe(100);
      done();
    });
  });

  it('normalizes dropdown object values before requesting aging', (done) => {
    const { service, api } = createService([]);
    service.getAgingReport('ent-1', {
      supplierId: { value: 7, label: '7 — Acme Ltda.' } as any,
      cutoffDate: new Date(2026, 7, 13),
    }).subscribe(() => {
      expect(api.aging).toHaveBeenCalledWith('ent-1', '2026-08-13', 7, undefined, undefined);
      done();
    });
  });

  it('uses cutoff date for report date and preserves days overdue from API', (done) => {
    const { service } = createService([
      {
        invoiceId: 2,
        supplierId: 7,
        reference: 'FC-200',
        accountCode: '220501',
        dueDate: '2026-08-01',
        daysOverdue: 12,
        current: 0,
        days1to30: 250,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
      },
    ]);
    service.getAgingReport('ent-1', { cutoffDate: new Date(2026, 7, 13) }).subscribe((report) => {
      expect(report.reportDate.toISOString().slice(0, 10)).toBe('2026-08-13');
      expect(report.lines[0].daysOverdue).toBe(12);
      expect(report.lines[0].days1to30).toBe(250);
      done();
    });
  });

  it('exports CSV from report data without document or account filters', (done) => {
    const { service } = createService([
      {
        invoiceId: 3,
        supplierId: 7,
        reference: 'FC-300',
        accountCode: '220501',
        dueDate: '2026-08-05',
        daysOverdue: 8,
        current: 50,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
      },
    ]);
    service.exportAgingReport('ent-1', { cutoffDate: new Date(2026, 7, 13) }).subscribe((blob) => {
      expect(blob.type).toContain('text/csv');
      done();
    });
  });
});
