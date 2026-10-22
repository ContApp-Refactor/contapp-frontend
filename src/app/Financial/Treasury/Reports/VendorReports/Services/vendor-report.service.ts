import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { ThirdService } from '../../../../../GeneralMasters/ThirdParties/Services/third.service';
import { Third } from '../../../../../GeneralMasters/ThirdParties/models/Third';
import { ePersonType } from '../../../../../GeneralMasters/ThirdParties/models/ePersonType';
import { eThirdType } from '../../../../../GeneralMasters/ThirdParties/models/eThirdType';
import { TreasuryApiService } from '../../../Shared/treasury-api.service';
import { PayableWriteOff, PaymentVoucher } from '../../../Shared/treasury-api.models';
import { resolveSupplierName } from '../../../Shared/treasury-third-party.integration';
import { educationalDescription, transactionTypeLabel } from '../../../Shared/treasury-status-labels';
import { VendorListFilter, VendorReport, VendorReportSummary, VendorReportTransaction } from '../Models/VendorReport';

export type VendorSupplierOption = Third & { displayName: string };

@Injectable({ providedIn: 'root' })
export class VendorReportService {
  constructor(
    private readonly api: TreasuryApiService,
    private readonly thirds: ThirdService,
    private readonly storage: LocalStorageMethods,
  ) {}

  private enterpriseId() {
    const id = this.storage.getIdEnterprise();
    if (!id) throw new Error('No hay una empresa activa');
    return id;
  }

  getProveedores(): Observable<VendorSupplierOption[]> {
    return this.thirds.getThirdsByType(this.enterpriseId(), eThirdType.Proveedor).pipe(
      map((page) => (page.content || []).map((third) => this.toSupplierOption(third))),
      catchError(() => of([])),
    );
  }

  getVendorSummaries(filter?: VendorListFilter): Observable<VendorReportSummary[]> {
    const enterpriseId = this.enterpriseId();
    const from = filter?.dateFrom ? this.toIsoDate(filter.dateFrom) : undefined;
    const to = filter?.dateTo ? this.toIsoDate(filter.dateTo) : undefined;

    return this.getProveedores().pipe(
      switchMap((suppliers) => {
        const selectedId = filter?.supplierId;
        const targetSuppliers =
          selectedId != null
            ? suppliers.filter((supplier) => Number(supplier.thId) === selectedId)
            : suppliers;

        if (!targetSuppliers.length) {
          return of([]);
        }

        const nameById = new Map(
          targetSuppliers.map((supplier) => [Number(supplier.thId), supplier.displayName]),
        );

        return forkJoin(
          targetSuppliers.map((supplier) =>
            this.api.statement(enterpriseId, Number(supplier.thId), from, to).pipe(
              catchError(() => of(null)),
            ),
          ),
        ).pipe(
          map((statements) =>
            (statements as any[])
              .filter(Boolean)
              .map((statement) => ({
                id: statement.supplierId,
                name: nameById.get(statement.supplierId) || `Proveedor ${statement.supplierId}`,
                totalDebits: statement.paid,
                totalCredits: statement.invoiced,
                currentBalance: statement.pending,
                lastTransactionDate: new Date(
                  Math.max(
                    ...(statement.invoices || []).map((invoice: any) =>
                      new Date(invoice.issueDate).getTime(),
                    ),
                    ...(statement.vouchers || []).map((voucher: any) =>
                      new Date(voucher.issueDate).getTime(),
                    ),
                    0,
                  ),
                ),
                transactionCount:
                  (statement.invoices?.length || 0) + (statement.vouchers?.length || 0),
              })),
          ),
        );
      }),
    );
  }

  getInvoiceOptions(vendorId: number): Observable<{ label: string; value: string }[]> {
    return this.api.pending(this.enterpriseId(), vendorId).pipe(
      map((items) =>
        (items || [])
          .map((p) => ({ label: `${p.reference} · ${this.formatMoney(p.availableAmount)}`, value: p.reference }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ),
      catchError(() => of([])),
    );
  }

  getVendorReport(
    vendorId: number,
    startDate: Date,
    endDate: Date,
    invoice?: string,
    active?: boolean,
    vendorName?: string,
  ): Observable<VendorReport> {
    return this.getProveedores().pipe(
      switchMap((suppliers) => {
        const supplierNameMap = new Map(
          suppliers.map((supplier) => [Number(supplier.thId), supplier.displayName] as const),
        );
        const resolvedName = resolveSupplierName(supplierNameMap, vendorId);

        return this.api
          .statement(
            this.enterpriseId(),
            vendorId,
            startDate.toISOString().slice(0, 10),
            endDate.toISOString().slice(0, 10),
            invoice,
            active,
          )
          .pipe(
            map((statement) => {
          const openingBalance = Number(statement.openingBalance || 0);
          const writeOffTotal = Number(statement.writeOffTotal || 0);
          const totalCredits = Number(statement.invoiced || 0);
          const periodPayments = Number(statement.paid || 0);
          const totalDebits = periodPayments + writeOffTotal;
          const closingBalance = Number(statement.pending || 0);
          const startIso = this.toIsoDate(startDate);
          const endIso = this.toIsoDate(endDate);

          const bills: VendorReportTransaction[] = (statement.invoices || []).map((inv: any) => ({
            date: this.toReportDate(inv.issueDate),
            dueDate: this.toReportDate(inv.dueDate),
            reference: inv.reference,
            documentNumber: inv.reference,
            type: 'Bill' as const,
            description: inv.active === false ? 'Factura de compra (Anulada)' : 'Factura de compra',
            debits: 0,
            credits: Number(inv.originalAmount || 0),
            balance: 0,
            documentStatus: inv.active === false ? 'VOIDED' : 'POSTED',
            voided: inv.active === false,
          }));

          const paymentRows = this.buildPaymentTransactions(
            statement.vouchers,
            vendorId,
            startIso,
            endIso,
          );

          const writeOffRows = this.buildWriteOffTransactions(
            statement.writeOffs,
            vendorId,
            startIso,
            endIso,
          );

          const transactions = this.applyRunningBalance(
            [
              ...bills.filter((row) => this.inIsoDateRange(row.date, startIso, endIso)),
              ...paymentRows,
              ...writeOffRows,
            ].sort((a, b) => a.date.getTime() - b.date.getTime()),
            openingBalance,
          );

          return {
            vendor: { id: vendorId, name: resolvedName },
            dateRange: { startDate, endDate },
            transactions,
            periodTotals: {
              openingBalance,
              periodPayments,
              totalDebits,
              totalCredits,
              writeOffTotal,
              netBalance: closingBalance,
            },
            totalDue: closingBalance,
            agingReport: {
              prePaid: 0,
              current: closingBalance,
              days0to30: 0,
              days31to60: 0,
              days61to90: 0,
              days91Plus: 0,
              total: closingBalance,
            },
          };
            }),
          );
      }),
    );
  }

  buildPdf(report: VendorReport): Blob {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const fmt = (n: number) => this.formatMoney(n);
    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(d));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Estado de cuenta por proveedor', 40, 36);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Proveedor: ${report.vendor.name}`, 40, 54);
    doc.text(
      `Período: ${fmtDate(report.dateRange.startDate)} — ${fmtDate(report.dateRange.endDate)}`,
      40,
      68,
    );
    doc.text(`Generado: ${fmtDate(new Date())}`, 40, 82);

    autoTable(doc, {
      startY: 96,
      theme: 'grid',
      head: [
        [
          'Fecha',
          'Vence',
          'Referencia',
          'Documento',
          'Comp. egreso',
          'Tipo',
          'Descripción',
          'Débitos',
          'Créditos',
          'Saldo',
        ],
      ],
      body: report.transactions.map((t) => [
        fmtDate(t.date),
        t.dueDate ? fmtDate(t.dueDate) : '-',
        t.reference || '-',
        t.documentNumber || '-',
        t.expenseReceiptNumber || '-',
        t.type === 'Bill' ? 'Factura' : transactionTypeLabel(t.type),
        t.description || '-',
        t.debits > 0 ? fmt(t.debits) : '-',
        t.credits > 0 ? fmt(t.credits) : '-',
        fmt(t.balance),
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [0, 86, 179], textColor: 255 },
      columnStyles: {
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 96;

    autoTable(doc, {
      startY: finalY + 16,
      theme: 'plain',
      body: [
        ...(report.periodTotals.openingBalance !== 0
          ? [['Saldo inicial', fmt(report.periodTotals.openingBalance)]]
          : []),
        ['Pagos del período', fmt(report.periodTotals.periodPayments)],
        ...(report.periodTotals.writeOffTotal > 0
          ? [['Bajas CxP efectivas', fmt(report.periodTotals.writeOffTotal)]]
          : []),
        ['Facturas del período', fmt(report.periodTotals.totalCredits)],
        ['Saldo pendiente', fmt(report.totalDue)],
      ],
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    const agingY = ((doc as any).lastAutoTable?.finalY ?? finalY) + 16;
    autoTable(doc, {
      startY: agingY,
      theme: 'grid',
      head: [['Antigüedad', 'Monto']],
      body: [
        ['Corriente', fmt(report.agingReport.current)],
        ['0-30 días', fmt(report.agingReport.days0to30)],
        ['31-60 días', fmt(report.agingReport.days31to60)],
        ['61-90 días', fmt(report.agingReport.days61to90)],
        ['91+ días', fmt(report.agingReport.days91Plus)],
        ['Total', fmt(report.agingReport.total)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [100, 100, 100] },
      columnStyles: { 1: { halign: 'right' } },
    });

    return doc.output('blob');
  }

  buildExcel(report: VendorReport): Blob {
    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(d));

    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};

    const headerInfo = [
      ['Estado de cuenta por proveedor'],
      ['Proveedor:', report.vendor.name],
      [
        'Período:',
        `${fmtDate(report.dateRange.startDate)} — ${fmtDate(report.dateRange.endDate)}`,
      ],
      ['Generado:', fmtDate(new Date())],
      [],
      ...(report.periodTotals.openingBalance !== 0
        ? [['Saldo inicial', report.periodTotals.openingBalance]]
        : []),
      ['Pagos del período', report.periodTotals.periodPayments],
      ...(report.periodTotals.writeOffTotal > 0
        ? [['Bajas CxP efectivas', report.periodTotals.writeOffTotal]]
        : []),
      ['Facturas del período', report.periodTotals.totalCredits],
      ['Saldo pendiente', report.totalDue],
      [],
    ];

    XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: 'A1' });

    const tableHeaders = [
      [
        'Fecha',
        'Vence',
        'Referencia',
        'Documento',
        'Comp. egreso',
        'Tipo',
        'Descripción',
        'Débitos',
        'Créditos',
        'Saldo',
      ],
    ];

    const tableData = report.transactions.map((t) => [
      fmtDate(t.date),
      t.dueDate ? fmtDate(t.dueDate) : '',
      t.reference || '',
      t.documentNumber || '',
      t.expenseReceiptNumber || '',
      t.type === 'Bill' ? 'Factura' : transactionTypeLabel(t.type),
      t.description || '',
      t.debits || 0,
      t.credits || 0,
      t.balance || 0,
    ]);

    XLSX.utils.sheet_add_aoa(ws, tableHeaders, { origin: 'A10' });
    XLSX.utils.sheet_add_aoa(ws, tableData, { origin: 'A11' });

    const agingStart = 11 + tableData.length + 2;
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ['Antigüedad de saldos'],
        ['Concepto', 'Monto'],
        ['Corriente', report.agingReport.current],
        ['0-30 días', report.agingReport.days0to30],
        ['31-60 días', report.agingReport.days31to60],
        ['61-90 días', report.agingReport.days61to90],
        ['91+ días', report.agingReport.days91Plus],
        ['Total', report.agingReport.total],
      ],
      { origin: `A${agingStart}` },
    );

    ws['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Estado de cuenta');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  exportToPdf(report: VendorReport): Blob {
    return this.buildPdf(report);
  }

  exportToExcel(report: VendorReport): Blob {
    return this.buildExcel(report);
  }

  private buildPaymentTransactions(
    vouchers: PaymentVoucher[] | undefined,
    vendorId: number,
    startIso: string,
    endIso: string,
  ): VendorReportTransaction[] {
    return (vouchers || []).flatMap((voucher) => {
      const status = String(voucher.status || '').toUpperCase();
      const isVoided = status === 'VOIDED';
      const issuedInPeriod = voucher.issueDate
        ? this.inIsoDateRange(this.toReportDate(voucher.issueDate), startIso, endIso)
        : false;

      return (voucher.details || [])
        .filter((detail) => Number(detail.supplierId) === vendorId)
        .flatMap((detail) => {
          const amount = Number(detail.amountPaid ?? detail.amount ?? 0);
          const reference = detail.invoiceReference || '';
          const description = this.paymentDescription(voucher.observations, voucher.voucherNumber);
          const paymentInformational = !issuedInPeriod;
          const paymentRow: VendorReportTransaction = {
            date: this.toReportDate(voucher.issueDate),
            reference,
            expenseReceiptNumber: voucher.voucherNumber,
            type: 'Payment',
            description: isVoided ? `${description} (Anulado)` : description,
            debits: amount,
            credits: 0,
            balance: 0,
            documentStatus: status || 'POSTED',
            voided: isVoided,
            informational: paymentInformational,
          };

          if (!isVoided) {
            return [paymentRow];
          }

          const reversalRow: VendorReportTransaction = {
            date: new Date(voucher.updatedAt || voucher.issueDate),
            reference,
            expenseReceiptNumber: voucher.voucherNumber,
            type: 'PaymentReversal',
            description: `Reversión pago${voucher.voucherNumber ? ` comprobante ${voucher.voucherNumber}` : ''} (Anulado)`,
            debits: 0,
            credits: amount,
            balance: 0,
            documentStatus: status || 'POSTED',
            voided: true,
            informational: paymentInformational,
          };

          return [paymentRow, reversalRow];
        });
    });
  }

  private buildWriteOffTransactions(
    writeOffs: PayableWriteOff[] | undefined,
    vendorId: number,
    startIso: string,
    endIso: string,
  ): VendorReportTransaction[] {
    return (writeOffs || []).flatMap((writeOff) => {
      const status = String(writeOff.status || '').toUpperCase();
      const isVoided = status === 'VOIDED';
      const createdInPeriod = writeOff.createdAt
        ? this.inIsoDateRange(this.toReportDate(writeOff.createdAt), startIso, endIso)
        : false;
      const reason = (writeOff.reason || '').trim();

      return (writeOff.details || [])
        .filter((detail) => Number(detail.supplierId) === vendorId)
        .flatMap((detail) => {
          const amount = Number(detail.amount || 0);
          const reference = detail.invoiceReference || '';
          const postedInformational = !createdInPeriod;
          const postedRow: VendorReportTransaction = {
            date: this.toReportDate(writeOff.createdAt!),
            reference,
            type: 'WriteOff',
            description: isVoided
              ? `${reason || 'Baja de cuenta por pagar'} (Anulada)`
              : reason || 'Baja de cuenta por pagar',
            debits: amount,
            credits: 0,
            balance: 0,
            documentStatus: status || 'POSTED',
            voided: isVoided,
            informational: postedInformational,
          };

          if (!isVoided) {
            return [postedRow];
          }

          const reversalRow: VendorReportTransaction = {
            date: new Date(writeOff.updatedAt || writeOff.createdAt!),
            reference,
            type: 'WriteOffReversal',
            description: `Reversión Baja CxP${reason ? `: ${reason}` : ''} (Anulada)`,
            debits: 0,
            credits: amount,
            balance: 0,
            documentStatus: status || 'POSTED',
            voided: true,
            informational: postedInformational,
          };

          return [postedRow, reversalRow];
        });
    });
  }

  private paymentDescription(observations?: string | null, voucherNumber?: string | null): string {
    const fallback = voucherNumber
      ? `Pago comprobante ${voucherNumber}`
      : 'Pago a proveedor';
    return educationalDescription(observations, fallback);
  }

  private applyRunningBalance(
    rows: VendorReportTransaction[],
    openingBalance: number,
  ): VendorReportTransaction[] {
    let running = openingBalance;
    return rows.map((row) => {
      if (!row.informational) {
        if (row.credits > 0) running += row.credits;
        if (row.debits > 0) running -= row.debits;
      }
      return { ...row, balance: running };
    });
  }

  private inIsoDateRange(date: Date, startIso: string, endIso: string): boolean {
    const value = this.toIsoDate(date);
    return value >= startIso && value <= endIso;
  }

  private toReportDate(value: Date | string): Date {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(value);
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  private toIsoDate(value: Date): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toSupplierOption(third: Third): VendorSupplierOption {
    return {
      ...third,
      displayName: this.thirdDisplayName(third),
    };
  }

  private thirdDisplayName(third: Third): string {
    if (third.personType === ePersonType.natural) {
      return `${third.names || ''} ${third.lastNames || ''}`.trim() || `Proveedor ${third.thId}`;
    }
    return third.socialReason || `Proveedor ${third.thId}`;
  }
}
