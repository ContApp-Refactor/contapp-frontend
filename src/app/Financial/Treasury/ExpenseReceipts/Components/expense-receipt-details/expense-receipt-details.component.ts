import { Component, OnInit } from '@angular/core';
import { ExpenseReceiptDetailsView, ExpenseReceiptDetailView } from '../../Model/ExpenseReceiptView';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ExpenseReceiptService } from '../../Service/expense-receipt.service';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import {
  AccountingEntryViewHeader,
  AccountingMovementViewRow,
  accountingTotalsBalanced,
} from '../../../Shared/treasury-accounting-display';
import { accountingEntryStatusLabel } from '../../../Shared/treasury-status-labels';

@Component({
  selector: 'app-expense-receipt-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    MessageModule,
    DialogModule,
    FormsModule,
    ConfirmDialogModule,
    ToastModule,
    TableModule,
    TagModule,
    CardModule,
    DividerModule,
  ],
  templateUrl: './expense-receipt-details.component.html',
  styleUrl: './expense-receipt-details.component.css',
  providers: [ConfirmationService, MessageService],
})
export class ExpenseReceiptDetailsComponent implements OnInit {
  receipt: ExpenseReceiptDetailsView | null = null;
  errorMessage: string | null = null;
  loading = false;

  displayAnnulDialog = false;
  annulReason = '';
  isSubmittingAnnulment = false;

  accountingEntryHeader: AccountingEntryViewHeader = {};
  accountingMovements: AccountingMovementViewRow[] = [];
  accountingDebitTotal = 0;
  accountingCreditTotal = 0;
  loadingAccounting = false;
  accountingStatusLabel = accountingEntryStatusLabel;
  expandedInvoiceIds = new Set<number>();
  loadingProductLines = new Set<number>();
  productLineErrors = new Map<number, string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private expenseReceiptService: ExpenseReceiptService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.loadReceiptDetails(+idParam);
    } else {
      this.errorMessage = 'No se proporcionó el identificador del comprobante.';
    }
  }

  loadReceiptDetails(id: number): void {
    this.errorMessage = null;
    this.loading = true;
    this.expenseReceiptService.getExpenseReceiptById(id).subscribe({
      next: (receipt) => {
        this.receipt = receipt || null;
        this.loading = false;
        if (this.receipt?.accountingEntryId) {
          this.showAccounting();
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No se pudo cargar la información del comprobante.';
      },
    });
  }

  get accountingIsBalanced(): boolean {
    return accountingTotalsBalanced(this.accountingDebitTotal, this.accountingCreditTotal);
  }

  formatMoney(amount: number | null | undefined): string {
    const value = Number(amount ?? 0);
    if (!Number.isFinite(value)) {
      return '—';
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  displayText(value: string | null | undefined): string {
    const text = (value ?? '').trim();
    return text || '—';
  }

  statusSeverity(): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    const key = this.receipt?.statusKey;
    if (key === 'POSTED') return 'success';
    if (key === 'VOIDED') return 'danger';
    if (key === 'FAILED' || key === 'VOID_FAILED') return 'danger';
    if (key === 'DRAFT') return 'secondary';
    if (key === 'POSTING' || key === 'VOIDING') return 'warn';
    return 'info';
  }

  showAccounting(): void {
    if (!this.receipt) {
      return;
    }
    this.loadingAccounting = true;
    this.accountingEntryHeader = {};
    this.accountingMovements = [];
    this.accountingDebitTotal = 0;
    this.accountingCreditTotal = 0;
    this.expenseReceiptService.getAccountingEntryView(this.receipt.id, {
      voucherNumber: this.receipt.receiptCode,
      supplierLabel: this.receipt.supplierName,
    }).subscribe({
      next: (view) => {
        this.accountingEntryHeader = view.header;
        this.accountingMovements = view.movements;
        this.accountingDebitTotal = this.accountingMovements.reduce((sum, row) => sum + row.debit, 0);
        this.accountingCreditTotal = this.accountingMovements.reduce((sum, row) => sum + row.credit, 0);
        if (this.receipt && !this.receipt.accountingEntryCode && view.header.entryCode) {
          this.receipt.accountingEntryCode = view.header.entryCode;
        }
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

  openScheduleDetail(): void {
    if (!this.receipt?.scheduleId) {
      return;
    }
    this.router.navigate(['/financial/treasury/purchase-bills'], {
      queryParams: { scheduleId: this.receipt.scheduleId },
    });
  }

  openAnnulDialog(): void {
    this.annulReason = '';
    this.displayAnnulDialog = true;
  }

  confirmAnnulment(): void {
    if (!this.receipt || !this.annulReason.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'Debe proporcionar una razón para la anulación.',
      });
      return;
    }

    this.isSubmittingAnnulment = true;
    const receiptCode = this.receipt.receiptCode;
    const receiptId = this.receipt.id;
    this.expenseReceiptService.voidExpenseReceipt(receiptId, this.annulReason).subscribe({
      next: (response) => {
        const code = response.receiptCode?.trim() || receiptCode;
        if (response.status === 'VOID_FAILED') {
          this.messageService.add({
            severity: 'error',
            summary: 'Anulación fallida',
            detail: `No se pudo anular el comprobante ${code}. Revise el estado en el listado.`,
          });
          return;
        }
        const stillVoiding = response.status === 'VOIDING';
        this.displayAnnulDialog = false;
        this.annulReason = '';
        this.router.navigate(['/financial/treasury/expense-receipts'], {
          state: {
            voidReceiptFeedback: {
              severity: stillVoiding ? 'warn' : 'success',
              summary: stillVoiding ? 'Anulación en proceso' : 'Éxito',
              detail: stillVoiding
                ? `El comprobante ${code} está anulándose. Verifique el estado en el listado en unos segundos.`
                : `Comprobante ${code} anulado correctamente.`,
            },
          },
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo anular el comprobante. Intente nuevamente.',
        });
      },
      complete: () => {
        this.isSubmittingAnnulment = false;
      },
    });
  }

  cancelAnnulment(): void {
    this.displayAnnulDialog = false;
    this.annulReason = '';
  }

  viewAccountingPage(): void {
    if (this.receipt) {
      this.router.navigate(['/financial/treasury/expense-receipts', this.receipt.id, 'accounting']);
    }
  }

  goBackToList(): void {
    this.router.navigate(['/financial/treasury/expense-receipts']);
  }

  isProductsExpanded(detail: ExpenseReceiptDetailView): boolean {
    return this.expandedInvoiceIds.has(detail.invoiceId);
  }

  isProductsLoading(detail: ExpenseReceiptDetailView): boolean {
    return this.loadingProductLines.has(detail.invoiceId);
  }

  productsError(detail: ExpenseReceiptDetailView): string | undefined {
    return this.productLineErrors.get(detail.invoiceId);
  }

  toggleProducts(detail: ExpenseReceiptDetailView): void {
    if (this.expandedInvoiceIds.has(detail.invoiceId)) {
      this.expandedInvoiceIds.delete(detail.invoiceId);
      return;
    }
    this.expandedInvoiceIds.add(detail.invoiceId);
    this.productLineErrors.delete(detail.invoiceId);
    if (detail.productLines) {
      return;
    }
    this.loadingProductLines.add(detail.invoiceId);
    this.expenseReceiptService.getPaidInvoiceProductLinesForObligation(detail.invoiceId).subscribe({
      next: ({ sourceInvoiceId, lines }) => {
        detail.sourceInvoiceId = sourceInvoiceId;
        detail.productLines = lines;
        this.loadingProductLines.delete(detail.invoiceId);
        if (!lines.length) {
          this.productLineErrors.set(
            detail.invoiceId,
            'La factura no tiene productos o servicios registrados.',
          );
        }
      },
      error: () => {
        this.loadingProductLines.delete(detail.invoiceId);
        this.productLineErrors.set(
          detail.invoiceId,
          'No fue posible consultar los productos de la factura.',
        );
      },
    });
  }
}
