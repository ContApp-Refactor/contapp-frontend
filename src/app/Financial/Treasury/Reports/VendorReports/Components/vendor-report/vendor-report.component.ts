import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';

import { VendorReportService } from '../../Services/vendor-report.service';
import { VendorReport, VendorReportTransaction } from '../../Models/VendorReport';
import { MessageService } from 'primeng/api';
import {
  exportErrorDetail,
  exportSuccessDetail,
  reportEmptyFiltersMessage,
  transactionTypeLabel,
  voucherStatusLabel,
} from '../../../../Shared/treasury-status-labels';
import { TreasuryExportService } from '../../../../Shared/treasury-export.service';
import { debounceTime, merge, Subject, takeUntil } from 'rxjs';

interface FilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-vendor-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    ToastModule,
    TagModule,
    TooltipModule,
    DividerModule,
    ProgressSpinnerModule,
    DropdownModule,
    InputTextModule,
  ],
  templateUrl: './vendor-report.component.html',
  styleUrls: ['./vendor-report.component.css'],
  providers: [MessageService],
})
export class VendorReportComponent implements OnInit, OnDestroy {
  vendorReport: VendorReport | null = null;
  visibleTransactions: VendorReportTransaction[] = [];
  loading = false;
  exportingPdf = false;
  exportingCsv = false;
  readonly emptyFiltersMessage = reportEmptyFiltersMessage();
  vendorId = 0;
  vendorName = '';

  dateRangeForm!: FormGroup;
  invoiceOptions: FilterOption[] = [];
  private readonly backendFilterChanges$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  statusOptions: FilterOption[] = [
    { label: 'Todos los documentos', value: '' },
    { label: 'Contabilizado', value: 'POSTED' },
    { label: 'Anulado', value: 'VOIDED' },
  ];

  periodOptions: { label: string; value: string; days?: number }[] = [
    { label: 'Personalizado', value: '' },
    { label: 'Este mes', value: 'THIS_MONTH' },
    { label: 'Últimos 7 días', value: 'LAST_7', days: 7 },
    { label: 'Últimos 30 días', value: 'LAST_30', days: 30 },
    { label: 'Últimos 90 días', value: 'LAST_90', days: 90 },
    { label: 'Año en curso', value: 'YTD' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private vendorReportService: VendorReportService,
    private messageService: MessageService,
    private exportService: TreasuryExportService,
  ) {}

  ngOnInit(): void {
    this.initializeDateRangeForm();
    this.getRouteParams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeDateRangeForm(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.dateRangeForm = this.fb.group({
      periodPreset: ['THIS_MONTH'],
      startDate: [firstDayOfMonth, Validators.required],
      endDate: [today, Validators.required],
      invoice: [null],
      status: [''],
    });

    this.backendFilterChanges$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.hasCompleteValidDateRange()) this.loadVendorReport();
      });

    this.dateRangeForm.get('periodPreset')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((preset) => {
        if (!preset) return;
        this.applyPeriodPreset(preset);
        this.queueBackendReload();
      });

    merge(
      this.dateRangeForm.get('startDate')!.valueChanges,
      this.dateRangeForm.get('endDate')!.valueChanges,
      this.dateRangeForm.get('invoice')!.valueChanges,
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.queueBackendReload());

    this.dateRangeForm.get('status')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => this.applyDocumentStatusFilter(status));
  }

  getRouteParams(): void {
    this.route.params.subscribe((params) => {
      this.vendorId = +params['id'];
      if (this.vendorId) {
        this.loadInvoiceOptions();
        this.loadVendorReport();
      }
    });

    this.route.queryParams.subscribe((queryParams) => {
      this.vendorName = queryParams['name'] || 'Proveedor';
    });
  }

  loadInvoiceOptions(): void {
    this.vendorReportService.getInvoiceOptions(this.vendorId).subscribe({
      next: (options) => {
        this.invoiceOptions = options;
      },
    });
  }

  applyPeriodPreset(preset: string): void {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let start = new Date(today);

    switch (preset) {
      case 'THIS_MONTH':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'YTD':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      default: {
        const option = this.periodOptions.find((o) => o.value === preset);
        if (option?.days) {
          start.setDate(today.getDate() - option.days);
        } else {
          return;
        }
      }
    }

    start.setHours(0, 0, 0, 0);
    this.dateRangeForm.patchValue(
      { startDate: start, endDate: today },
      { emitEvent: false },
    );
  }

  loadVendorReport(): void {
    if (!this.hasCompleteValidDateRange() || !this.vendorId) return;

    const formValue = this.dateRangeForm.value;
    this.loading = true;

    this.vendorReportService
      .getVendorReport(
        this.vendorId,
        formValue.startDate,
        formValue.endDate,
        formValue.invoice || undefined,
        undefined,
        this.vendorName,
      )
      .subscribe({
        next: (report) => {
          this.vendorReport = report;
          this.updateStatusOptions(report.transactions);
          this.applyDocumentStatusFilter(formValue.status);
          this.vendorName = report.vendor.name;
          this.loading = false;
          if (!this.invoiceOptions.length && report.transactions.length) {
            this.invoiceOptions = [...new Set(report.transactions.map((t) => t.reference).filter(Boolean))]
              .map((ref) => ({ label: ref, value: ref }))
              .sort((a, b) => a.label.localeCompare(b.label));
          }
        },
        error: (error) => {
          console.error('Error al cargar el reporte:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar el reporte del proveedor',
          });
          this.loading = false;
        },
      });
  }

  clearFilters(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.dateRangeForm.reset(
      {
        periodPreset: 'THIS_MONTH',
        startDate: firstDayOfMonth,
        endDate: today,
        invoice: null,
        status: '',
      },
      { emitEvent: false },
    );
    this.applyDocumentStatusFilter('');
    this.queueBackendReload();
  }

  applyDocumentStatusFilter(status: string | null | undefined): void {
    const transactions = this.vendorReport?.transactions || [];
    this.visibleTransactions = status
      ? transactions.filter((transaction) => transaction.documentStatus === status)
      : [...transactions];
  }

  private updateStatusOptions(transactions: VendorReportTransaction[]): void {
    const statuses = [...new Set([
      'POSTED',
      'VOIDED',
      ...transactions.map((transaction) => transaction.documentStatus).filter(Boolean),
    ])];
    this.statusOptions = [
      { label: 'Todos los documentos', value: '' },
      ...statuses.map((status) => {
        const translated = voucherStatusLabel(status);
        return { label: translated === 'Desconocido' ? status : translated, value: status };
      }),
    ];
  }

  goBack(): void {
    this.router.navigate(['/financial/treasury/reports/vendors']);
  }

  exportToPdf(): void {
    const report = this.currentReportForExport();
    if (!report) return;
    this.exportingPdf = true;
    try {
      this.exportService.triggerBrowserDownload(
        this.vendorReportService.exportToPdf(report),
        this.exportFileName('pdf'),
      );
      this.messageService.add({
        severity: 'success',
        summary: 'Exportado',
        detail: exportSuccessDetail('estado de cuenta', 'pdf'),
      });
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: exportErrorDetail('pdf'),
      });
    } finally {
      this.exportingPdf = false;
    }
  }

  exportToCsv(): void {
    if (!this.vendorReport) return;
    this.exportingCsv = true;
    try {
      const headers = [
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
      ];
      const rows = this.visibleTransactions.map((transaction) => [
        this.formatDate(transaction.date),
        transaction.dueDate ? this.formatDate(transaction.dueDate) : '-',
        transaction.reference || '-',
        transaction.documentNumber || '-',
        transaction.expenseReceiptNumber || '-',
        transactionTypeLabel(transaction.type),
        transaction.description || '-',
        transaction.debits || 0,
        transaction.credits || 0,
        transaction.balance || 0,
      ]);

      this.exportService.downloadCsv({
        title: 'Estado de cuenta por proveedor',
        subtitle: `${this.vendorReport.vendor.name} · ${this.formatDate(this.vendorReport.dateRange.startDate)} — ${this.formatDate(this.vendorReport.dateRange.endDate)}`,
        filename: this.exportFileName('csv'),
        headers,
        rows,
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Exportado',
        detail: exportSuccessDetail('estado de cuenta', 'csv'),
      });
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: exportErrorDetail('csv'),
      });
    } finally {
      this.exportingCsv = false;
    }
  }

  private exportFileName(ext: string): string {
    const safeName = this.vendorName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `estado_cuenta_${safeName}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  private queueBackendReload(): void {
    this.backendFilterChanges$.next();
  }

  private hasCompleteValidDateRange(): boolean {
    const startDate = this.dateRangeForm?.get('startDate')?.value;
    const endDate = this.dateRangeForm?.get('endDate')?.value;
    return startDate instanceof Date
      && endDate instanceof Date
      && !Number.isNaN(startDate.getTime())
      && !Number.isNaN(endDate.getTime())
      && startDate <= endDate;
  }

  private currentReportForExport(): VendorReport | null {
    return this.vendorReport
      ? { ...this.vendorReport, transactions: [...this.visibleTransactions] }
      : null;
  }

  getTransactionTypeTag(type: VendorReportTransaction['type'], voided?: boolean): {
    severity: 'success' | 'info' | 'warn' | 'warning' | 'danger' | 'secondary' | 'contrast';
    text: string;
  } {
    const text = transactionTypeLabel(type);
    if (voided && type === 'Bill') {
      return { severity: 'danger', text: 'Factura (Anulada)' };
    }
    if (voided && type === 'WriteOff') {
      return { severity: 'danger', text: `${text} (Anulada)` };
    }
    if (voided && type === 'Payment') {
      return { severity: 'danger', text: `${text} (Anulado)` };
    }
    const severity =
      type === 'Payment'
        ? 'success'
        : type === 'PaymentReversal'
          ? 'warn'
          : type === 'WriteOffReversal'
            ? 'warn'
            : type === 'WriteOff'
              ? 'warning'
              : 'info';
    return { severity, text };
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) return 'text-red-600 font-semibold';
    if (balance < 0) return 'text-green-600 font-semibold';
    return 'text-gray-600';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatDate(date: Date | string): string {
    return this.exportService.formatDate(date);
  }
}
