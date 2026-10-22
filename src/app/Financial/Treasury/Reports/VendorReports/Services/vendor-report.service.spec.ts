import { of } from 'rxjs';
import { ePersonType } from '../../../../../GeneralMasters/ThirdParties/models/ePersonType';
import { VendorReportService } from './vendor-report.service';

describe('VendorReportService summaries', () => {
  function emptyThirds() {
    return {
      getThirdsByType: jasmine.createSpy('getThirdsByType').and.returnValue(of({ content: [] })),
    };
  }

  function service() {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 7,
        invoiced: 500,
        paid: 100,
        pending: 400,
        invoices: [{ issueDate: '2026-08-14' }],
        vouchers: [],
      })),
    };
    const thirds = {
      getThirdsByType: jasmine.createSpy('getThirdsByType').and.returnValue(of({
        content: [{
          thId: 7,
          entId: 'enterprise-a',
          typeId: {} as any,
          thirdTypes: [],
          personType: ePersonType.juridica,
          socialReason: 'PEPSI',
          idNumber: 7,
          state: true,
          address: 'addr',
          phoneNumber: '1',
          email: 'a@b.com',
        }],
      })),
      getThirdParties: jasmine.createSpy('getThirdParties'),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    return { value, api, thirds };
  }

  it('loads summaries from proveedores by type', (done) => {
    const { value, thirds } = service();
    value.getVendorSummaries().subscribe((summaries) => {
      expect(thirds.getThirdsByType).toHaveBeenCalledWith('enterprise-a', 'Proveedor');
      expect(summaries.length).toBe(1);
      expect(summaries[0].name).toBe('PEPSI');
      done();
    });
  });

  it('reconciles statement totals with detail movements', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 22436,
        invoiced: 97566,
        paid: 115376,
        writeOffTotal: 0,
        pending: 4646,
        invoices: [{
          issueDate: '2026-08-05',
          dueDate: '2026-09-05',
          reference: 'FC-1',
          originalAmount: 97566,
          pendingAmount: 4646,
        }],
        vouchers: [{
          issueDate: '2026-08-10',
          voucherNumber: 'CE-001',
          observations: '12',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-OLD',
            amountPaid: 115376,
            remainingBalance: 0,
          }],
        }],
        writeOffs: [],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      expect(report.periodTotals.openingBalance).toBe(22436);
      expect(report.periodTotals.totalCredits).toBe(97566);
      expect(report.periodTotals.totalDebits).toBe(115376);
      expect(report.totalDue).toBe(4646);
      expect(report.transactions.find((row) => row.type === 'Payment')?.description)
        .toBe('Pago comprobante CE-001');
      const detailCredits = report.transactions.reduce((sum, row) => sum + row.credits, 0);
      const detailDebits = report.transactions.reduce((sum, row) => sum + row.debits, 0);
      expect(
        report.periodTotals.openingBalance + detailCredits - detailDebits - report.periodTotals.writeOffTotal,
      ).toBe(report.totalDue);
      const lastBalance = report.transactions.at(-1)?.balance;
      expect(lastBalance).toBe(report.totalDue);
      done();
    });
  });

  it('passes supplier and date filters to statement API', (done) => {
    const { value, api } = service();
    const dateFrom = new Date(2026, 7, 1);
    const dateTo = new Date(2026, 7, 31);
    value.getVendorSummaries({ supplierId: 7, dateFrom, dateTo }).subscribe(() => {
      expect(api.statement).toHaveBeenCalledWith('enterprise-a', 7, '2026-08-01', '2026-08-31');
      done();
    });
  });

  it('shows voided write-off history without affecting effective totals', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 0,
        pending: 357000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 357000,
        }],
        vouchers: [],
        writeOffs: [{
          id: 5,
          status: 'VOIDED',
          reason: 'Ajuste',
          createdAt: '2026-08-10T12:00:00Z',
          updatedAt: '2026-08-12T15:00:00Z',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amount: 100000,
          }],
        }],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      expect(report.periodTotals.writeOffTotal).toBe(0);
      expect(report.totalDue).toBe(357000);
      expect(report.transactions.some((row) => row.type === 'WriteOff' && row.voided)).toBeTrue();
      expect(report.transactions.some((row) => row.type === 'WriteOffReversal')).toBeTrue();
      expect(report.transactions.at(-1)?.balance).toBe(357000);
      done();
    });
  });

  it('maps period payments from API paid without mixing write-offs', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 100000,
        pending: 257000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 257000,
        }],
        vouchers: [],
        writeOffs: [{
          id: 5,
          status: 'POSTED',
          reason: 'Ajuste',
          createdAt: '2026-08-10T12:00:00Z',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amount: 100000,
          }],
        }],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      expect(report.periodTotals.periodPayments).toBe(0);
      expect(report.periodTotals.writeOffTotal).toBe(100000);
      expect(report.periodTotals.totalDebits).toBe(100000);
      expect(report.totalDue).toBe(257000);
      done();
    });
  });

  it('keeps payments and write-offs separated when both exist', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 50000,
        writeOffTotal: 100000,
        pending: 207000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 207000,
        }],
        vouchers: [{
          issueDate: '2026-08-08',
          voucherNumber: 'CE-001',
          observations: 'Pago',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amountPaid: 50000,
          }],
        }],
        writeOffs: [],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      expect(report.periodTotals.periodPayments).toBe(50000);
      expect(report.periodTotals.writeOffTotal).toBe(100000);
      expect(report.totalDue).toBe(207000);
      done();
    });
  });

  it('keeps invoice-only statement without write-off rows', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 0,
        pending: 357000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 357000,
        }],
        vouchers: [],
        writeOffs: [],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      expect(report.transactions.length).toBe(1);
      expect(report.transactions[0].type).toBe('Bill');
      expect(report.totalDue).toBe(357000);
      expect(report.agingReport.total).toBe(357000);
      expect(report.transactions.at(-1)?.balance).toBe(357000);
      done();
    });
  });

  it('passes the voided document filter and marks voided invoices explicitly', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 100000,
        paid: 0,
        writeOffTotal: 0,
        pending: 100000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-VOID',
          originalAmount: 100000,
          pendingAmount: 100000,
          active: false,
        }],
        vouchers: [],
        writeOffs: [],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, false, 'Proveedor').subscribe((report) => {
      expect(api.statement).toHaveBeenCalledWith(
        'enterprise-a', 78, '2026-08-01', '2026-08-31', undefined, false,
      );
      expect(report.transactions).toContain(jasmine.objectContaining({
        type: 'Bill',
        documentStatus: 'VOIDED',
        voided: true,
        description: 'Factura de compra (Anulada)',
      }));
      done();
    });
  });

  it('shows voided payment history without affecting effective totals', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 0,
        pending: 357000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 357000,
        }],
        vouchers: [{
          issueDate: '2026-08-10',
          voucherNumber: 'CE-100',
          status: 'VOIDED',
          updatedAt: '2026-08-12T15:00:00Z',
          accountingEntryId: 88,
          observations: 'Pago',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amountPaid: 100000,
          }],
        }],
        writeOffs: [],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      expect(report.periodTotals.periodPayments).toBe(0);
      expect(report.totalDue).toBe(357000);
      expect(report.transactions.some((row) =>
        row.type === 'Payment' && row.voided && row.documentStatus === 'VOIDED',
      )).toBeTrue();
      expect(report.transactions.some((row) =>
        row.type === 'PaymentReversal' && row.documentStatus === 'VOIDED',
      )).toBeTrue();
      expect(report.transactions.at(-1)?.balance).toBe(357000);
      expect(report.agingReport.total).toBe(357000);
      done();
    });
  });

  it('reconciles posted payment running balance with pending', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 100000,
        writeOffTotal: 0,
        pending: 257000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 257000,
        }],
        vouchers: [{
          issueDate: '2026-08-10',
          voucherNumber: 'CE-100',
          status: 'POSTED',
          accountingEntryId: 88,
          observations: 'Pago',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amountPaid: 100000,
          }],
        }],
        writeOffs: [],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      const payment = report.transactions.find((row) => row.type === 'Payment');
      expect(payment?.debits).toBe(100000);
      expect(payment?.documentStatus).toBe('POSTED');
      expect(report.periodTotals.periodPayments).toBe(100000);
      expect(report.transactions.at(-1)?.balance).toBe(257000);
      expect(report.totalDue).toBe(257000);
      expect(report.agingReport.total).toBe(257000);
      done();
    });
  });

  it('restores running balance when voided write-off reversal is outside report period', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 0,
        pending: 357000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 357000,
        }],
        vouchers: [],
        writeOffs: [{
          id: 5,
          status: 'VOIDED',
          reason: 'Ajuste',
          createdAt: '2026-08-10T12:00:00Z',
          updatedAt: '2026-09-05T12:00:00Z',
          accountingEntryId: 12,
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amount: 100000,
          }],
        }],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      const writeOff = report.transactions.find((row) => row.type === 'WriteOff');
      const reversal = report.transactions.find((row) => row.type === 'WriteOffReversal');
      expect(writeOff?.balance).toBe(257000);
      expect(reversal?.balance).toBe(357000);
      expect(report.transactions.at(-1)?.balance).toBe(357000);
      expect(report.totalDue).toBe(357000);
      done();
    });
  });

  it('restores running balance through combined payment and write-off voids', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 0,
        pending: 357000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 357000,
        }],
        vouchers: [{
          issueDate: '2026-08-08',
          voucherNumber: 'CE-001',
          status: 'VOIDED',
          updatedAt: '2026-08-20T12:00:00Z',
          accountingEntryId: 20,
          observations: 'Pago',
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amountPaid: 50000,
          }],
        }],
        writeOffs: [{
          id: 5,
          status: 'VOIDED',
          reason: 'Ajuste',
          createdAt: '2026-08-10T12:00:00Z',
          updatedAt: '2026-08-18T12:00:00Z',
          accountingEntryId: 12,
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amount: 100000,
          }],
        }],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      const balances = report.transactions.map((row) => row.balance);
      expect(balances).toEqual([357000, 307000, 207000, 307000, 357000]);
      expect(report.periodTotals.writeOffTotal).toBe(0);
      expect(report.periodTotals.periodPayments).toBe(0);
      expect(report.transactions.at(-1)?.balance).toBe(357000);
      done();
    });
  });

  it('reconciles posted write-off running balance with pending', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 100000,
        pending: 257000,
        invoices: [{
          issueDate: '2026-08-01',
          dueDate: '2026-09-01',
          reference: 'FC-357',
          originalAmount: 357000,
          pendingAmount: 257000,
        }],
        vouchers: [],
        writeOffs: [{
          id: 5,
          status: 'POSTED',
          reason: 'Ajuste',
          createdAt: '2026-08-10T12:00:00Z',
          accountingEntryId: 12,
          details: [{
            supplierId: 78,
            invoiceReference: 'FC-357',
            amount: 100000,
          }],
        }],
      })),
    };
    const thirds = emptyThirds();
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor').subscribe((report) => {
      const writeOff = report.transactions.find((row) => row.type === 'WriteOff');
      expect(writeOff?.debits).toBe(100000);
      expect(report.transactions.at(-1)?.balance).toBe(257000);
      expect(report.totalDue).toBe(257000);
      done();
    });
  });

  it('resolves canonical supplier name from thirds', (done) => {
    const api = {
      statement: jasmine.createSpy('statement').and.returnValue(of({
        supplierId: 78,
        openingBalance: 0,
        invoiced: 357000,
        paid: 0,
        writeOffTotal: 0,
        pending: 357000,
        invoices: [],
        vouchers: [],
        writeOffs: [],
      })),
    };
    const thirds = {
      getThirdsByType: jasmine.createSpy('getThirdsByType').and.returnValue(of({
        content: [{
          thId: 78,
          entId: 'enterprise-a',
          typeId: {} as any,
          thirdTypes: [],
          personType: ePersonType.juridica,
          socialReason: 'PEPSI',
          idNumber: 7,
          state: true,
          address: 'addr',
          phoneNumber: '1',
          email: 'a@b.com',
        }],
      })),
      getThirdParties: jasmine.createSpy('getThirdParties'),
    };
    const storage = { getIdEnterprise: () => 'enterprise-a' };
    const value = new VendorReportService(api as any, thirds as any, storage as any);
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 7, 31);

    value.getVendorReport(78, start, end, undefined, undefined, 'Proveedor 78').subscribe((report) => {
      expect(thirds.getThirdsByType).toHaveBeenCalledWith('enterprise-a', 'Proveedor');
      expect(report.vendor.name).toBe('PEPSI');
      done();
    });
  });
});
