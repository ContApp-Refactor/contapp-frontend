import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AccountingNoteService } from '../../Services/accounting-note.service';
import { MovementItem } from '../../Models/accounting-note.models';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { accountingErrorMessage } from '../../Services/accounting-error-message';

@Component({
  selector: 'app-accounting-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DatePickerModule, InputTextModule, SelectModule, TableModule, ToastModule],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.css'],
})
export class TransactionsComponent {
  accountCode = '';
  startDate = new Date(new Date().getFullYear(), 0, 1);
  endDate = new Date();
  thirdPartyId = '';
  costCenterCode = '';
  originModule = '';
  totalDebit = 0;
  totalCredit = 0;
  closingBalance = 0;
  previousBalance = 0;
  movements: MovementItem[] = [];
  loading = false;

  constructor(
    private readonly noteService: AccountingNoteService,
    private readonly messages: MessageService,
    private readonly localStorageMethods: LocalStorageMethods,
  ) {}

  search(): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId || !this.accountCode || !this.startDate || !this.endDate) {
      this.messages.add({ severity: 'warn', summary: 'Filtros incompletos', detail: 'Selecciona una empresa e indica la cuenta y el periodo.' });
      return;
    }
    if (this.startDate > this.endDate) {
      this.messages.add({ severity: 'warn', summary: 'Periodo inválido', detail: 'La fecha inicial debe ser anterior o igual a la fecha final.' });
      return;
    }
    this.loading = true;
    this.noteService.getMovements(
      this.accountCode.trim(), enterpriseId, this.formatDate(this.startDate), this.formatDate(this.endDate),
      this.thirdPartyId.trim(), this.costCenterCode.trim(), this.originModule.trim(),
    ).subscribe({
      next: (response) => {
        this.previousBalance = response.previousBalance;
        this.totalDebit = response.totalDebit;
        this.totalCredit = response.totalCredit;
        this.closingBalance = response.closingBalance;
        this.movements = response.movements;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.messages.add({
          severity: 'error',
          summary: 'No fue posible consultar los movimientos',
          detail: accountingErrorMessage(error, 'Revisa la cuenta, el periodo y los filtros e inténtalo de nuevo.'),
        });
      },
    });
  }

  get sources(): string[] {
    return [...new Set(this.movements.map((movement) => movement.originModule).filter(Boolean))];
  }

  private formatDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
