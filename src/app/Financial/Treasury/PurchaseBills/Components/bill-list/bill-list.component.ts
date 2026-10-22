import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';

import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { MessageService } from 'primeng/api';
import { TreasuryExportService } from '../../../Shared/treasury-export.service';
import {
  exportErrorDetail,
  exportSuccessDetail,
  reportEmptyFiltersMessage,
  scheduleStatusFilterOptions,
  scheduleStatusLabel,
} from '../../../Shared/treasury-status-labels';
import { ContextualHelpComponent } from '../../../../../Shared/Components/contextual-help/contextual-help.component';
import { TREASURY_HELP } from '../../../Shared/treasury-help-content';
import { TreasuryApiService } from '../../../Shared/treasury-api.service';
import { Payable, PaymentSchedule } from '../../../Shared/treasury-api.models';
import { PaymentMethodsServiceService } from '../../../../../GeneralMasters/PaymentMethods/services/payment-methods-service.service';
import { ThirdService } from '../../../../../GeneralMasters/ThirdParties/Services/third.service';
import { buildThirdPartyNameMap } from '../../../Shared/treasury-third-party.integration';
import {
  formatTreasuryInstant,
  buildTreasuryScheduleDetailView,
  scheduleInvoicesLabel,
  scheduleMethodLabel,
  scheduleSuppliersLabel,
  scheduleTotal,
  scheduleTypeLabel,
  scheduleVoucherLabel,
} from '../../../Shared/treasury-schedule-display';
import { TreasuryScheduleDetailPanelComponent } from '../../../Shared/treasury-schedule-detail-panel.component';
import { BankAccountsService } from '../../../../../GeneralMasters/BankAccounts/services/bank-accounts.service';

interface SupplierFilterOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-bill-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    TooltipModule,
    TagModule,
    CardModule,
    ToastModule,
    DialogModule,
    ContextualHelpComponent,
    TreasuryScheduleDetailPanelComponent,
  ],
  templateUrl: './bill-list.component.html',
  styleUrls: ['./bill-list.component.css'],
  providers: [MessageService],
})
export class BillListComponent implements OnInit {
  private readonly localStorageMethods = new LocalStorageMethods();

  allSchedules: PaymentSchedule[] = [];
  filteredSchedules: PaymentSchedule[] = [];
  filterForm!: FormGroup;
  supplierOptions: SupplierFilterOption[] = [];
  statusOptions = scheduleStatusFilterOptions();
  supplierNames = new Map<number, string>();
  payableReferences = new Map<number, string>();
  methods: any[] = [];
  banks: any[] = [];
  scheduleDetailDialogVisible = false;
  scheduleDetailTarget?: PaymentSchedule;
  scheduleTypeLabel = scheduleTypeLabel;
  formatTreasuryInstant = formatTreasuryInstant;

  loading = false;
  actionBusy = false;
  exportingPdf = false;
  exportingCsv = false;
  readonly emptyFiltersMessage = reportEmptyFiltersMessage();
  readonly help = TREASURY_HELP.paymentSchedule;
  readonly scheduleLabel = scheduleStatusLabel;
  readonly scheduleTotalFn = scheduleTotal;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: TreasuryApiService,
    private readonly paymentMethods: PaymentMethodsServiceService,
    private readonly thirds: ThirdService,
    private readonly bankAccounts: BankAccountsService,
    private readonly messageService: MessageService,
    private readonly exportService: TreasuryExportService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      supplierId: [null],
      status: [''],
      dateFrom: [null],
      dateTo: [null],
    });
    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
    this.loadSchedules();
  }

  loadSchedules(): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Empresa requerida',
        detail: 'Seleccione una empresa activa para ver las programaciones.',
      });
      return;
    }

    this.loading = true;
    forkJoin({
      schedules: this.api.schedules(enterpriseId),
      methods: this.paymentMethods.findAllActive(enterpriseId),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000).pipe(catchError(() => of({ content: [] } as any))),
      payables: this.api.pending(enterpriseId),
      banks: this.bankAccounts.findAllActive(enterpriseId).pipe(catchError(() => of({ content: [] } as any))),
    }).subscribe({
      next: (data) => {
        this.allSchedules = data.schedules ?? [];
        this.methods = data.methods?.content ?? [];
        this.banks = data.banks?.content ?? [];
        this.supplierNames = buildThirdPartyNameMap(data.thirds?.content || []);
        this.payableReferences = new Map(
          (data.payables ?? []).map((payable: Payable) => [payable.id, payable.reference]),
        );
        this.buildSupplierOptions();
        this.filteredSchedules = [...this.allSchedules];
        this.applyFilters();
        this.loading = false;
        const scheduleId = Number(this.route.snapshot.queryParamMap.get('scheduleId'));
        if (scheduleId) {
          const schedule = this.allSchedules.find((item) => item.id === scheduleId);
          if (schedule) {
            this.showScheduleDetail(schedule);
          }
        }
      },
      error: (error) => {
        console.error('Error al cargar programaciones:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las programaciones. Intente nuevamente.',
        });
        this.loading = false;
      },
    });
  }

  buildSupplierOptions(): void {
    const supplierIds = new Set<number>();
    this.allSchedules.forEach((schedule) => {
      (schedule.details ?? []).forEach((detail) => supplierIds.add(detail.supplierId));
    });
    this.supplierOptions = [...supplierIds]
      .map((id) => ({
        value: id,
        label: this.supplierNames.get(id) ?? `Proveedor ${id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  applyFilters(): void {
    const filters = this.filterForm.value;
    this.filteredSchedules = this.allSchedules.filter((schedule) => {
      if (filters.status && schedule.status !== filters.status) {
        return false;
      }

      if (filters.supplierId != null) {
        const supplierId = Number(filters.supplierId);
        const matchesSupplier = (schedule.details ?? []).some((detail) => detail.supplierId === supplierId);
        if (!matchesSupplier) {
          return false;
        }
      }

      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(schedule.executionDate) < from) {
          return false;
        }
      }

      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(schedule.executionDate) > to) {
          return false;
        }
      }

      return true;
    });
  }

  clearFilters(): void {
    this.filterForm.reset({
      supplierId: null,
      status: '',
      dateFrom: null,
      dateTo: null,
    });
    this.filteredSchedules = [...this.allSchedules];
  }

  suppliersLabel(item: PaymentSchedule): string {
    return scheduleSuppliersLabel(item, this.supplierNames);
  }

  invoicesLabel(item: PaymentSchedule): string {
    return scheduleInvoicesLabel(item, this.payableReferences, this.formatMoney);
  }

  methodLabel(item: PaymentSchedule): string {
    return scheduleMethodLabel(item, this.methods);
  }

  scheduleVoucherLabel(item: PaymentSchedule): string {
    return scheduleVoucherLabel(item);
  }

  canCancelSchedule(item: PaymentSchedule): boolean {
    return item.status === 'SCHEDULED';
  }

  canViewScheduleVoucher(item: PaymentSchedule): boolean {
    return item.status === 'EXECUTED' && item.voucherId != null;
  }

  showScheduleDetail(item: PaymentSchedule): void {
    this.scheduleDetailTarget = item;
    this.scheduleDetailDialogVisible = true;
  }

  cancelScheduleDetailDialog(): void {
    this.scheduleDetailDialogVisible = false;
    this.scheduleDetailTarget = undefined;
  }

  scheduleBankLabel(item: PaymentSchedule): string {
    if (!item.bankAccountId) {
      return '—';
    }
    const bank = this.banks.find((entry) => Number(entry.id) === Number(item.bankAccountId));
    if (!bank) {
      return '—';
    }
    return `${bank.bank?.name || 'Banco'} - ${bank.accountNumber}`;
  }

  scheduleDetailView(item?: PaymentSchedule) {
    if (!item) {
      return null;
    }
    return buildTreasuryScheduleDetailView(item, {
      executionDate: this.formatDate(item.executionDate),
      type: this.scheduleTypeLabel(item),
      supplier: this.suppliersLabel(item),
      method: this.methodLabel(item),
      bank: this.scheduleBankLabel(item),
      total: this.formatCurrency(this.scheduleTotalFn(item)),
      statusLabel: this.scheduleLabel(item.status),
      statusSeverity: this.getStatusSeverity(item.status),
      invoices: this.invoicesLabel(item),
      showVoucher: this.canViewScheduleVoucher(item),
      voucher: this.scheduleVoucherLabel(item),
    });
  }

  openScheduleVoucher(item: PaymentSchedule): void {
    if (!item.voucherId) {
      return;
    }
    this.router.navigate(['/financial/treasury/expense-receipts/details', item.voucherId]);
  }

  cancelSchedule(schedule: PaymentSchedule): void {
    this.runScheduleAction(this.api.cancelSchedule(schedule.id), 'Programación cancelada.');
  }

  retrySchedule(schedule: PaymentSchedule): void {
    this.runScheduleAction(this.api.retrySchedule(schedule.id), 'Reintento de programación iniciado.');
  }

  private runScheduleAction(action: Observable<PaymentSchedule>, successDetail: string): void {
    this.actionBusy = true;
    action.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: successDetail,
        });
        this.loadSchedules();
        this.actionBusy = false;
      },
      error: (error) => {
        console.error('Error en programación:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error?.error?.message || 'No se pudo completar la acción.',
        });
        this.actionBusy = false;
      },
    });
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'EXECUTED':
      case 'SCHEDULED':
        return 'success';
      case 'PROCESSING':
      case 'WAITING_ACCOUNTING':
        return 'info';
      case 'FAILED':
        return 'danger';
      case 'CANCELED':
        return 'secondary';
      default:
        return 'warning';
    }
  }

  formatCurrency(amount: number): string {
    return this.formatMoney(amount);
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  }

  exportToCsv(): void {
    this.runExport('csv');
  }

  exportToPdf(): void {
    this.runExport('pdf');
  }

  private runExport(format: 'csv' | 'pdf'): void {
    if (!this.filteredSchedules.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: this.emptyFiltersMessage,
      });
      return;
    }

    const headers = ['Fecha ejecución', 'Proveedor', 'Factura(s)', 'Método', 'Estado', 'Total', 'Reintentos', 'Comprobante'];
    const rows = this.filteredSchedules.map((item) => [
      item.executionDate,
      this.suppliersLabel(item),
      this.invoicesLabel(item),
      this.methodLabel(item),
      this.scheduleLabel(item.status),
      scheduleTotal(item),
      item.retryCount,
      this.scheduleVoucherLabel(item),
    ]);
    const options = {
      title: 'Programación de pagos',
      subtitle: `${rows.length} programación(es) exportada(s)`,
      filename: this.exportService.datedFilename('programacion-pagos', format),
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
        detail: exportSuccessDetail('programación de pagos', format),
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

  getScheduledCount(): number {
    return this.allSchedules.filter((item) => item.status === 'SCHEDULED').length;
  }

  getExecutedCount(): number {
    return this.allSchedules.filter((item) => item.status === 'EXECUTED').length;
  }

  getFailedCount(): number {
    return this.allSchedules.filter((item) => item.status === 'FAILED').length;
  }

  getCanceledCount(): number {
    return this.allSchedules.filter((item) => item.status === 'CANCELED').length;
  }
}
