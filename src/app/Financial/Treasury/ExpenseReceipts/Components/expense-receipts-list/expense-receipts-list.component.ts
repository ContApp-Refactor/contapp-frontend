import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ExpenseReceiptService } from '../../Service/expense-receipt.service';
import { DropdownOption, ExpenseReceiptView, ReceiptFilterOption } from '../../Model/Models';
import { exportErrorDetail, exportSuccessDetail, reportEmptyFiltersMessage, voucherStatusFilterOptions, accountingEntryStatusLabel } from '../../../Shared/treasury-status-labels';
import {
  AccountingEntryViewHeader,
  AccountingMovementViewRow,
  accountingTotalsBalanced,
} from '../../../Shared/treasury-accounting-display';
import { ContextualHelpComponent } from '../../../../../Shared/Components/contextual-help/contextual-help.component';
import { TREASURY_HELP } from '../../../Shared/treasury-help-content';
import { TreasuryExportService } from '../../../Shared/treasury-export.service';

@Component({
  selector: 'app-expense-receipts-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    CalendarModule,
    DropdownModule,
    TooltipModule,
    CardModule,
    ToastModule,
    TagModule,
    MessageModule,
    ContextualHelpComponent,
  ],
  templateUrl: './expense-receipts-list.component.html',
  styleUrls: ['./expense-receipts-list.component.css'],
  providers: [MessageService],
})
export class ExpenseReceiptsListComponent implements OnInit {
  filterForm!: FormGroup;
  allReceipts: ExpenseReceiptView[] = [];
  filteredReceipts: ExpenseReceiptView[] = [];
  loading = false;

  supplierOptions: ReceiptFilterOption[] = [];

  statusOptions: DropdownOption[] = voucherStatusFilterOptions();
  readonly emptyFiltersMessage = reportEmptyFiltersMessage();
  readonly help = TREASURY_HELP.expenseReceipts;
  exportingPdf = false;
  exportingCsv = false;
  accountingEntry: any = null;
  accountingEntryHeader: AccountingEntryViewHeader = {};
  accountingMovements: AccountingMovementViewRow[] = [];
  accountingDebitTotal = 0;
  accountingCreditTotal = 0;
  accountingReceiptCode = '';
  loadingAccounting = false;

  accountingStatusLabel = accountingEntryStatusLabel;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private expenseReceiptService: ExpenseReceiptService,
    private messageService: MessageService,
    private exportService: TreasuryExportService,
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.setupFilterSubscriptions();
    this.showVoidNavigationFeedback();
    this.loadReceipts();
  }

  private showVoidNavigationFeedback(): void {
    const navigationState = this.router.lastSuccessfulNavigation?.extras?.state as {
      voidReceiptFeedback?: {
        severity: 'success' | 'warn' | 'error';
        summary: string;
        detail: string;
      };
    } | undefined;
    const historyState = history.state as {
      voidReceiptFeedback?: {
        severity: 'success' | 'warn' | 'error';
        summary: string;
        detail: string;
      };
    };
    const feedback = navigationState?.voidReceiptFeedback ?? historyState?.voidReceiptFeedback;
    if (!feedback) {
      return;
    }
    if (historyState?.voidReceiptFeedback) {
      const { voidReceiptFeedback: _, ...rest } = history.state as Record<string, unknown>;
      history.replaceState(rest, '');
    }
    setTimeout(() => {
      this.messageService.add({
        severity: feedback.severity,
        summary: feedback.summary,
        detail: feedback.detail,
        life: 8000,
      });
    });
  }

  initializeForm(): void {
    this.filterForm = this.fb.group({
      supplierId: [null],
      receiptCode: [''],
      startDate: [null],
      endDate: [null],
      status: [''],
    });
  }

  setupFilterSubscriptions(): void {
    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  loadReceipts(): void {
    this.loading = true;
    this.expenseReceiptService.getAllExpenseReceipts().subscribe({
      next: (data) => {
        this.allReceipts = data;
        this.buildFilterOptions(data);
        this.filteredReceipts = [...data];
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los comprobantes de egreso.',
        });
      },
    });
  }

  buildFilterOptions(receipts: ExpenseReceiptView[]): void {
    this.supplierOptions = [...new Set(receipts.map((r) => r.thirdPartyId).filter((id) => id > 0))]
      .map((id) => {
        const name = receipts.find((r) => r.thirdPartyId === id)?.supplierName || `Proveedor ${id}`;
        return { value: id, label: `${id} — ${name}` };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  applyFilters(): void {
    const filters = this.filterForm.value;
    let results = [...this.allReceipts];

    if (filters.supplierId != null) {
      results = results.filter((r) => r.thirdPartyId === Number(filters.supplierId));
    }

    const receiptCodeTerm = String(filters.receiptCode ?? '').trim().toLowerCase();
    if (receiptCodeTerm) {
      results = results.filter((r) => String(r.receiptCode).toLowerCase().includes(receiptCodeTerm));
    }

    if (filters.status) {
      results = results.filter((r) => (r.statusKey || '') === filters.status);
    }

    if (filters.startDate) {
      const from = new Date(filters.startDate);
      from.setHours(0, 0, 0, 0);
      results = results.filter((r) => new Date(r.issueDate) >= from);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      results = results.filter((r) => new Date(r.issueDate) <= endDate);
    }

    this.filteredReceipts = results;
  }

  clearFilters(): void {
    this.filterForm.reset({
      supplierId: null,
      receiptCode: '',
      startDate: null,
      endDate: null,
      status: '',
    });
    this.filteredReceipts = [...this.allReceipts];
  }

  viewReceiptDetails(receipt: ExpenseReceiptView): void {
    this.router.navigate(['/financial/treasury/expense-receipts/details', receipt.id]);
  }

  showAccounting(receipt: ExpenseReceiptView): void {
    this.loadingAccounting = true;
    this.accountingEntry = null;
    this.accountingEntryHeader = {};
    this.accountingMovements = [];
    this.accountingDebitTotal = 0;
    this.accountingCreditTotal = 0;
    this.accountingReceiptCode = receipt.receiptCode;
    this.expenseReceiptService.getAccountingEntryView(receipt.id, {
      voucherNumber: receipt.receiptCode,
      supplierLabel: receipt.supplierName,
    }).subscribe({
      next: (view) => {
        this.accountingEntry = view.header;
        this.accountingEntryHeader = view.header;
        this.accountingMovements = view.movements;
        this.accountingDebitTotal = this.accountingMovements.reduce((sum, row) => sum + row.debit, 0);
        this.accountingCreditTotal = this.accountingMovements.reduce((sum, row) => sum + row.credit, 0);
        this.loadingAccounting = false;
      },
      error: () => {
        this.loadingAccounting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Asiento no disponible',
          detail: 'No fue posible consultar el asiento del comprobante.',
        });
      },
    });
  }

  get accountingIsBalanced(): boolean {
    return accountingTotalsBalanced(this.accountingDebitTotal, this.accountingCreditTotal);
  }

  clearAccountingView(): void {
    this.accountingEntry = null;
    this.accountingEntryHeader = {};
    this.accountingMovements = [];
    this.accountingDebitTotal = 0;
    this.accountingCreditTotal = 0;
    this.accountingReceiptCode = '';
  }

  getTotalReceipts(): number {
    return this.allReceipts.length;
  }

  getActiveReceipts(): number {
    return this.filteredReceipts.filter((r) => r.statusKey === 'POSTED' || r.status === 'Contabilizado').length;
  }

  getCancelledReceipts(): number {
    return this.filteredReceipts.filter((r) => r.statusKey === 'VOIDED' || r.status === 'Anulado').length;
  }

  getTotalAmount(): number {
    return this.filteredReceipts
      .filter((r) => r.statusKey !== 'VOIDED' && r.status !== 'Anulado')
      .reduce((sum, receipt) => sum + (receipt.totalAmount || 0), 0);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' {
    switch ((status || '').toLowerCase()) {
      case 'contabilizado':
      case 'pagado':
      case 'completado':
        return 'success';
      case 'borrador':
      case 'contabilizando':
      case 'pendiente':
        return 'warning';
      case 'anulado':
      case 'fallido':
      case 'anulación fallida':
      case 'anulando':
      case 'cancelado':
        return 'danger';
      default:
        return 'info';
    }
  }

  cancelReceipt(receipt: ExpenseReceiptView): void {
    if (receipt.statusKey === 'VOIDED' || receipt.status === 'Anulado') {
      return;
    }

    this.messageService.add({
      severity: 'warn',
      summary: 'Anular Comprobante',
      detail: `Use Operaciones de Tesorería para anular ${receipt.receiptCode}.`,
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  }

  exportToCsv(): void {
    this.runExport('csv');
  }

  exportToPdf(): void {
    this.runExport('pdf');
  }

  private runExport(format: 'csv' | 'pdf'): void {
    if (!this.filteredReceipts.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: this.emptyFiltersMessage,
      });
      return;
    }

    const headers = ['Código', 'Fecha', 'Proveedor', 'Total', 'Estado'];
    const rows = this.filteredReceipts.map((receipt) => [
      receipt.receiptCode,
      this.formatDate(receipt.issueDate),
      receipt.supplierName,
      receipt.totalAmount,
      receipt.status,
    ]);
    const options = {
      title: 'Comprobantes de egreso',
      subtitle: `${rows.length} comprobante(s) exportado(s)`,
      filename: this.exportService.datedFilename('comprobantes-egreso', format),
      headers,
      rows,
    };

    const loadingFlag = format === 'csv' ? 'exportingCsv' : 'exportingPdf';
    this[loadingFlag] = true;
    try {
      if (format === 'csv') {
        this.exportService.downloadCsv(options);
      } else {
        this.exportService.downloadPdf(options);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'Exportado',
        detail: exportSuccessDetail('comprobantes', format),
      });
    } catch (error) {
      console.error(`Error al exportar ${format}:`, error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: exportErrorDetail(format),
      });
    } finally {
      this[loadingFlag] = false;
    }
  }
}
