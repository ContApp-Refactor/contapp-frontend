import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ExpenseReceiptService } from '../../Service/expense-receipt.service';
import { TableModule } from 'primeng/table';
import {
  AccountingEntryViewHeader,
  AccountingMovementViewRow,
  accountingTotalsBalanced,
} from '../../../Shared/treasury-accounting-display';
import { accountingEntryStatusLabel } from '../../../Shared/treasury-status-labels';

@Component({
  selector: 'app-expense-receipt-accounting',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    MessageModule,
    CurrencyPipe,
    DatePipe,
    TableModule
  ],
  templateUrl: './expense-receipt-accounting.component.html',
  styleUrls: ['./expense-receipt-accounting.component.css']
})
export class ExpenseReceiptAccountingComponent implements OnInit {
  receiptId: number | null = null;
  receiptCode: string | null = null;
  issueDate: Date | null = null;
  supplierName: string | null = null;
  accountingEntryHeader: AccountingEntryViewHeader = {};
  accountingMovements: AccountingMovementViewRow[] = [];
  errorMessage: string | null = null;
  accountingStatusLabel = accountingEntryStatusLabel;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private expenseReceiptService: ExpenseReceiptService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.receiptId = +idParam;
      this.loadAccountingEntries(this.receiptId);
    } else {
      this.errorMessage = 'No se proporcionó el identificador del comprobante.';
    }
  }

  loadAccountingEntries(id: number): void {
    this.expenseReceiptService.getExpenseReceiptById(id).subscribe({
      next: (receipt) => {
        if (!receipt) {
          return;
        }
        this.receiptCode = receipt.receiptCode;
        this.issueDate = receipt.issueDate;
        this.supplierName = receipt.supplierName;
        this.expenseReceiptService.getAccountingEntryView(id, {
          voucherNumber: receipt.receiptCode,
          supplierLabel: receipt.supplierName,
        }).subscribe({
          next: (view) => {
            this.accountingEntryHeader = view.header;
            this.accountingMovements = view.movements;
          },
          error: () => this.errorMessage = 'El asiento aún no está disponible o fue rechazado.',
        });
      },
      error: (err) => {
        console.error(err);
        this.accountingMovements = [];
        this.errorMessage = 'No se pudieron cargar los asientos contables.';
      }
    });
  }

  viewReceiptDetails(): void {
    if (this.receiptId) {
      this.router.navigate(['/financial/treasury/expense-receipts/details/', this.receiptId]);
    } else {
      this.router.navigate(['/financial/treasury/expense-receipts']);
    }
  }

  goBackToList(): void {
    this.router.navigate(['/financial/treasury/expense-receipts']);
  }

  getTotalDebit(): number {
    return this.accountingMovements.reduce((sum, entry) => sum + entry.debit, 0);
  }

  getTotalCredit(): number {
    return this.accountingMovements.reduce((sum, entry) => sum + entry.credit, 0);
  }

  get accountingIsBalanced(): boolean {
    return accountingTotalsBalanced(this.getTotalDebit(), this.getTotalCredit());
  }

  get accountingEntryIsVoided(): boolean {
    return String(this.accountingEntryHeader.entryStatus || '').toUpperCase() === 'VOIDED';
  }
}
