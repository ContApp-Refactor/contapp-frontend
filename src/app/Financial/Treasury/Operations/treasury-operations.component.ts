import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable, of, Subject, timer, TimeoutError } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, take, takeUntil, takeWhile, timeout } from 'rxjs/operators';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import { PaymentMethodsServiceService } from '../../../GeneralMasters/PaymentMethods/services/payment-methods-service.service';
import { ChartAccountService } from '../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { BankAccountsService } from '../../../GeneralMasters/BankAccounts/services/bank-accounts.service';
import { ThirdService } from '../../../GeneralMasters/ThirdParties/Services/third.service';
import { TreasuryApiService } from '../Shared/treasury-api.service';
import { Payable, PayableWriteOff, PaymentSchedule, PaymentVoucher } from '../Shared/treasury-api.models';
import {
  accountingEntryStatusLabel,
  accountingSourceDocumentTypeLabel,
  exportErrorDetail,
  exportSuccessDetail,
  scheduleStatusLabel,
  translatePaymentMethodName,
  voucherStatusFilterOptions,
  voucherStatusLabel,
} from '../Shared/treasury-status-labels';
import { TreasuryExportService } from '../Shared/treasury-export.service';
import {
  buildActiveAccountIdSet,
  filterSelectablePaymentMethods,
} from '../Shared/treasury-account.integration';
import {
  buildTreasuryScheduleDetailView,
  formatTreasuryInstant,
  scheduleInvoicesLabel,
  scheduleMethodLabel,
  scheduleSuppliersLabel,
  scheduleTotal,
  scheduleTypeLabel,
  scheduleVoucherLabel,
} from '../Shared/treasury-schedule-display';
import { TreasuryScheduleDetailPanelComponent } from '../Shared/treasury-schedule-detail-panel.component';
import { buildThirdPartyNameMap, resolveSupplierName } from '../Shared/treasury-third-party.integration';
import {
  AccountingEntryViewHeader,
  AccountingMovementViewRow,
  accountingTotalsBalanced,
  buildAccountCatalogueLookup,
  buildAccountingEntryView,
  flattenAccountCatalogueRefs,
  mapAccountingMovementsForView,
} from '../Shared/treasury-accounting-display';
import { ContextualHelpComponent } from '../../../Shared/Components/contextual-help/contextual-help.component';
import { TREASURY_HELP } from '../Shared/treasury-help-content';
import {
  NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE,
  paymentMethodsAvailabilityMessage,
} from '../Shared/treasury-payment-messages';
import {
  ACTIVE_PAYMENT_SCHEDULE_BLOCK_MESSAGE,
  SCHEDULE_FUTURE_DATE_REQUIRED_MESSAGE,
} from '../Shared/treasury-schedule-messages';
import {
  WRITE_OFF_AMOUNT_EXCEEDS_MESSAGE,
  WRITE_OFF_AMOUNT_INVALID_MESSAGE,
  WRITE_OFF_COUNTERPART_REQUIRED_MESSAGE,
  WRITE_OFF_CREATE_SUCCESS_MESSAGE,
  WRITE_OFF_NO_AVAILABLE_BALANCE_MESSAGE,
  WRITE_OFF_PENDING_BLOCK_MESSAGE,
  WRITE_OFF_POST_FAILED_MESSAGE,
  WRITE_OFF_POSTED_PARTIAL_MESSAGE,
  WRITE_OFF_POSTED_TOTAL_MESSAGE,
  WRITE_OFF_REASON_REQUIRED_MESSAGE,
  WRITE_OFF_DISCARD_SUCCESS_MESSAGE,
  WRITE_OFF_DISCARD_TOOLTIP,
  WRITE_OFF_VOID_TOOLTIP,
  WRITE_OFF_VOIDED_MESSAGE,
  WRITE_OFF_VOID_FAILED_MESSAGE,
} from '../Shared/treasury-writeoff-messages';
import { hasActiveWriteOffForInvoice } from '../Shared/treasury-writeoff-availability';
import { ExpenseReceiptService } from '../ExpenseReceipts/Service/expense-receipt.service';
import { Supplier } from '../ExpenseReceipts/Model/Models';

@Component({
  selector: 'app-treasury-operations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DatePickerModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextarea,
    MessageModule,
    TableModule,
    TagModule,
    SelectButtonModule,
    TooltipModule,
    ToastModule,
    ContextualHelpComponent,
    AutoCompleteModule,
    TreasuryScheduleDetailPanelComponent,
  ],
  templateUrl: './treasury-operations.component.html',
  styleUrl: './treasury-operations.component.css',
  providers: [MessageService],
})
export class TreasuryOperationsComponent implements OnInit, OnDestroy {
  private static readonly OPERATION_TIMEOUT_MS = 20_000;
  private static readonly POST_POLL_INTERVAL_MS = 2_000;
  private static readonly POST_POLL_MAX_ATTEMPTS = 15;
  private static readonly VOUCHER_FILTER_DEBOUNCE_MS = 300;
  private static readonly LOAD_ERROR_MESSAGE = 'No fue posible cargar la información de Tesorería.';
  private readonly destroy$ = new Subject<void>();
  private readonly voucherNumberFilter$ = new Subject<string>();

  @ViewChild('writeOffsSection') writeOffsSection?: ElementRef<HTMLElement>;

  payables: Payable[] = [];
  vouchers: PaymentVoucher[] = [];
  allVouchers: PaymentVoucher[] = [];
  schedules: PaymentSchedule[] = [];
  writeOffs: PayableWriteOff[] = [];
  methods: any[] = [];
  methodOptions: { id: number; label: string }[] = [];
  allPaymentMethodsCount = 0;
  banks: any[] = [];
  accounts: any[] = [];
  accountingAccountLookup = new Map<number, { code: string; description: string }>();
  loading = false;
  loaded = false;
  loadError = '';
  bankOptions: { id: number; label: string }[] = [];
  accountOptions: { id: number; label: string }[] = [];
  readonly paymentAmountOptions = [
    { label: 'Total', value: 'full' as const },
    { label: 'Parcial', value: 'partial' as const },
  ];
  minExecutionDate!: Date;
  writeOffDialogVisible = false;
  writeOffDiscardDialogVisible = false;
  writeOffDetailDialogVisible = false;
  scheduleDetailDialogVisible = false;
  writeOffDiscardTarget?: PayableWriteOff;
  writeOffDetailTarget?: PayableWriteOff;
  scheduleDetailTarget?: PaymentSchedule;
  writeOffTarget?: Payable;
  writeOffAmount?: number;
  writeOffCounterpartAccountId?: number;
  writeOffReason = '';
  paymentDialogVisible = false;
  dialogLines: {
    invoiceId: number;
    supplierId: number;
    reference: string;
    amount: number;
    maxAmount: number;
    paymentMode: 'full' | 'partial';
    payableAccountId?: number;
    payableAccountCode?: string;
  }[] = [];
  dialogPaymentMethodId?: number;
  dialogBankAccountId?: number;
  dialogObservations = '';
  scheduleDialogVisible = false;
  scheduleLines: TreasuryOperationsComponent['dialogLines'] = [];
  schedulePaymentMethodId?: number;
  scheduleBankAccountId?: number;
  scheduleExecutionDate?: Date;
  scheduleObservations = '';
  editingVoucherId?: number;
  postingVoucherId?: number;
  voucherNumberFilter = '';
  voucherStatusFilter = '';
  voucherSupplierFilter: Supplier | null = null;
  voucherDateFrom?: Date;
  voucherDateTo?: Date;
  filteredVoucherSuppliers: Supplier[] = [];
  voucherTableFirst = 0;
  accountingEntry: any = null;
  accountingEntryHeader: AccountingEntryViewHeader = {};
  accountingMovements: AccountingMovementViewRow[] = [];
  accountingDebitTotal = 0;
  accountingCreditTotal = 0;
  busy = false;
  error = '';
  readonly writeOffDiscardTooltip = WRITE_OFF_DISCARD_TOOLTIP;
  readonly writeOffVoidTooltip = WRITE_OFF_VOID_TOOLTIP;
  exportingPdf = false;
  exportingCsv = false;
  dueDateDialogVisible = false;
  dueDateTarget?: Payable;
  newDueDate?: Date;
  dueDateReason = '';
  minDueDate!: Date;
  readonly help = TREASURY_HELP.operations;
  readonly writeOffCounterpartHelp = TREASURY_HELP.writeOffCounterpartAccount;
  readonly noAvailableBankAccountsMessage = NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE;
  readonly voucherStatusOptions = voucherStatusFilterOptions();
  private supplierNames = new Map<number, string>();
  private payableByInvoiceId = new Map<number, Payable>();

  statusLabel = voucherStatusLabel;

  voucherAccountingEntryLabel(voucher: PaymentVoucher): string {
    const code = voucher.accountingEntryCode?.trim();
    return code ? code : '—';
  }

  writeOffNumberLabel(item: PayableWriteOff): string {
    return String(item.id);
  }

  writeOffAccountingEntryLabel(item: PayableWriteOff): string {
    const code = item.accountingEntryCode?.trim();
    return code ? code : '—';
  }

  writeOffDateLabel(item: PayableWriteOff): string {
    const raw = item.createdAt;
    if (!raw) {
      return '—';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  writeOffSupplierLabel(item: PayableWriteOff): string {
    const detail = item.details?.[0];
    let supplierId = detail?.supplierId != null ? Number(detail.supplierId) : undefined;
    if (supplierId == null) {
      const payable = this.findPayableForWriteOff(item);
      if (payable?.supplierId != null) {
        supplierId = Number(payable.supplierId);
      }
    }
    if (supplierId == null) {
      return '—';
    }
    return resolveSupplierName(this.supplierNames, supplierId);
  }

  writeOffInvoiceReference(item: PayableWriteOff): string {
    const details = item.details ?? [];
    if (!details.length) {
      return '—';
    }
    const refs = details.map((detail) => {
      const fromApi = detail.invoiceReference?.trim();
      if (fromApi) {
        return fromApi;
      }
      const payable = this.payables.find((entry) => entry.id === detail.invoiceId);
      if (payable?.reference?.trim()) {
        return payable.reference.trim();
      }
      return null;
    }).filter((value): value is string => Boolean(value));
    if (!refs.length) {
      return '—';
    }
    return [...new Set(refs)].join(', ');
  }

  writeOffCounterpartLabel(item: PayableWriteOff): string {
    const id = item.counterpartAccountId;
    const account = id != null
      ? this.accounts.find((entry) => Number(entry.id) === Number(id))
      : undefined;
    if (account) {
      const code = this.resolveAccountCode(account);
      return `${code} - ${account.description}`;
    }
    const code = item.counterpartAccountCode?.trim();
    if (code) {
      const byCode = this.accounts.find(
        (entry) => this.resolveAccountCode(entry) === code,
      );
      if (byCode) {
        return `${this.resolveAccountCode(byCode)} - ${byCode.description}`;
      }
      return code;
    }
    return '—';
  }

  writeOffPayableAccountLabel(item: PayableWriteOff): string {
    const detail = item.details?.[0];
    if (!detail) {
      return '—';
    }
    const account = this.accounts.find(
      (entry) => entry.id === detail.payableAccountId
        || this.resolveAccountCode(entry) === detail.payableAccountCode,
    );
    if (account) {
      return `${this.resolveAccountCode(account)} - ${account.description}`;
    }
    return detail.payableAccountCode?.trim() ?? '—';
  }

  writeOffAvailableBalanceLabel(item: PayableWriteOff): string {
    const detail = item.details?.[0];
    if (detail?.availableAmount != null) {
      return this.formatMoney(Number(detail.availableAmount));
    }
    const payable = this.findPayableForWriteOff(item);
    if (payable?.availableAmount != null) {
      return this.formatMoney(Number(payable.availableAmount));
    }
    return '—';
  }

  writeOffOriginalBalanceLabel(item: PayableWriteOff): string {
    const detail = item.details?.[0];
    if (detail?.originalAmount != null) {
      return this.formatMoney(Number(detail.originalAmount));
    }
    const payable = this.findPayableForWriteOff(item);
    if (payable?.originalAmount != null) {
      return this.formatMoney(Number(payable.originalAmount));
    }
    return '—';
  }

  canPostWriteOff(item: PayableWriteOff): boolean {
    return item.status === 'DRAFT' || item.status === 'FAILED';
  }

  canDiscardWriteOff(item: PayableWriteOff): boolean {
    return item.status === 'DRAFT';
  }

  canVoidWriteOff(item: PayableWriteOff): boolean {
    return item.status === 'POSTED' || item.status === 'VOID_FAILED';
  }

  canShowWriteOffAccounting(item: PayableWriteOff): boolean {
    return item.accountingEntryId != null && item.status !== 'DRAFT';
  }

  showWriteOffDetail(item: PayableWriteOff) {
    this.writeOffDetailTarget = item;
    this.writeOffDetailDialogVisible = true;
    if (!item.id) {
      return;
    }
    this.api.writeOff(item.id).subscribe({
      next: (fresh) => {
        const normalized = this.normalizeWriteOff(fresh);
        this.writeOffDetailTarget = normalized;
        this.upsertWriteOff(fresh);
        this.ensurePayablesForWriteOffs([normalized]).subscribe();
      },
    });
  }

  cancelWriteOffDetailDialog() {
    this.writeOffDetailDialogVisible = false;
    this.writeOffDetailTarget = undefined;
  }

  showWriteOffAccounting(item: PayableWriteOff) {
    if (!item.accountingEntryId) {
      return;
    }
    this.busy = true;
    this.accountingEntry = null;
    this.accountingEntryHeader = {};
    this.accountingMovements = [];
    this.accountingDebitTotal = 0;
    this.accountingCreditTotal = 0;
    const accountLookup = this.accountingAccountLookup;
    const supplierIds = [...new Set((item.details ?? []).map((detail) => detail.supplierId))];
    const supplierLabel = supplierIds
      .map((id) => this.supplierNames.get(Number(id)) ?? '—')
      .join(', ');

    this.api.accountingEntry(item.id, 'PAYABLE_WRITEOFF').subscribe({
      next: (value) => {
        const entry = value?.data ?? value;
        const view = buildAccountingEntryView(
          entry as Record<string, unknown>,
          mapAccountingMovementsForView(entry?.movements ?? entry?.details ?? [], accountLookup),
          {
            documentTypeLabel: accountingSourceDocumentTypeLabel('PAYABLE_WRITEOFF'),
            voucherNumber: this.writeOffNumberLabel(item),
            supplierLabel,
            entryCode: this.writeOffAccountingEntryLabel(item) !== '—'
              ? this.writeOffAccountingEntryLabel(item)
              : undefined,
          },
        );
        this.accountingEntry = entry;
        this.accountingEntryHeader = view.header;
        this.accountingMovements = view.movements;
        this.accountingDebitTotal = this.accountingMovements.reduce((sum, row) => sum + row.debit, 0);
        this.accountingCreditTotal = this.accountingMovements.reduce((sum, row) => sum + row.credit, 0);
        this.busy = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No fue posible consultar el asiento.';
        this.busy = false;
      },
    });
  }
  scheduleLabel = scheduleStatusLabel;
  writeOffLabel = voucherStatusLabel;
  accountingStatusLabel = accountingEntryStatusLabel;
  supplierName = (supplierId: number) => resolveSupplierName(this.supplierNames, supplierId);

  private loadedEnterpriseId = '';

  private get enterpriseId(): string {
    return this.loadedEnterpriseId || this.storage.getIdEnterprise();
  }

  constructor(
    private readonly api: TreasuryApiService,
    private readonly storage: LocalStorageMethods,
    private readonly paymentMethods: PaymentMethodsServiceService,
    private readonly chart: ChartAccountService,
    private readonly bankAccounts: BankAccountsService,
    private readonly thirds: ThirdService,
    private readonly exportService: TreasuryExportService,
    private readonly messageService: MessageService,
    private readonly expenseReceiptService: ExpenseReceiptService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    const today = this.stripTime(new Date());
    this.minDueDate = this.addDays(today, 1);
    this.minExecutionDate = this.addDays(today, 1);
    this.setupVoucherFilterSubscriptions();
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupVoucherFilterSubscriptions(): void {
    this.voucherNumberFilter$
      .pipe(
        debounceTime(TreasuryOperationsComponent.VOUCHER_FILTER_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.resetVoucherTablePage();
        this.applyVoucherFilters();
      });
  }

  onVoucherNumberFilterChange(value: string): void {
    this.voucherNumberFilter = value ?? '';
    this.voucherNumberFilter$.next(this.voucherNumberFilter);
  }

  onVoucherStatusFilterChange(): void {
    this.resetVoucherTablePage();
    this.applyVoucherFilters();
  }

  onVoucherSupplierFilterChange(): void {
    this.resetVoucherTablePage();
    this.applyVoucherFilters();
  }

  onVoucherDateFilterChange(): void {
    this.resetVoucherTablePage();
    this.applyVoucherFilters();
  }

  searchVoucherSupplier(event: { query?: string }): void {
    const query = String(event.query ?? '').trim().toLowerCase();
    this.expenseReceiptService.getSuppliers(query).subscribe((suppliers) => {
      this.filteredVoucherSuppliers = query
        ? suppliers.filter((supplier) => supplier.name.toLowerCase().startsWith(query))
        : suppliers;
    });
  }

  clearVoucherFilters(): void {
    this.voucherNumberFilter = '';
    this.voucherStatusFilter = '';
    this.voucherSupplierFilter = null;
    this.voucherDateFrom = undefined;
    this.voucherDateTo = undefined;
    this.filteredVoucherSuppliers = [];
    this.resetVoucherTablePage();
    this.applyVoucherFilters();
  }

  onVoucherTablePage(event: { first?: number }): void {
    this.voucherTableFirst = event.first ?? 0;
  }

  private resetVoucherTablePage(): void {
    this.voucherTableFirst = 0;
  }

  applyVoucherFilters(): void {
    const numberQuery = this.voucherNumberFilter.trim().toLowerCase();
    const status = this.voucherStatusFilter;
    const supplierId = this.voucherSupplierFilter?.id;

    this.vouchers = this.allVouchers.filter((voucher) => {
      if (numberQuery && !voucher.voucherNumber?.toLowerCase().includes(numberQuery)) {
        return false;
      }
      if (status && voucher.status !== status) {
        return false;
      }
      if (supplierId != null) {
        const supplierIds = [...new Set((voucher.details ?? []).map((detail) => detail.supplierId))];
        if (!supplierIds.includes(supplierId)) {
          return false;
        }
      }
      if (this.voucherDateFrom) {
        const from = this.stripTime(this.voucherDateFrom);
        if (new Date(voucher.issueDate) < from) {
          return false;
        }
      }
      if (this.voucherDateTo) {
        const to = this.stripTime(this.voucherDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(voucher.issueDate) > to) {
          return false;
        }
      }
      return true;
    });
  }

  reload() {
    const enterpriseId = this.storage.getIdEnterprise();
    this.error = '';
    this.loadError = '';

    if (!enterpriseId) {
      this.loading = false;
      this.loaded = false;
      this.busy = false;
      this.loadError = 'Seleccione una empresa activa.';
      return;
    }

    if (this.loadedEnterpriseId && this.loadedEnterpriseId !== enterpriseId) {
      this.loaded = false;
    }
    this.loading = true;
    this.busy = true;
    forkJoin({
      payables: this.api.pending(enterpriseId),
      vouchers: this.api.vouchers(enterpriseId, { size: 1000 }),
      schedules: this.api.schedules(enterpriseId),
      writeOffs: this.api.writeOffs(enterpriseId),
      methods: this.paymentMethods.findAllActive(enterpriseId),
      banks: this.bankAccounts.findAllActive(enterpriseId),
      accounts: this.chart.getListAuxiliaryAccounts(enterpriseId),
      accountCatalogue: this.chart.getListAccounts(enterpriseId),
      thirds: this.thirds.getThirdParties(enterpriseId, 0, 1000),
    }).subscribe({
      next: data => {
        this.payables = data.payables;
        this.supplierNames = buildThirdPartyNameMap(data.thirds?.content || []);
        this.allVouchers = data.vouchers.content;
        this.applyVoucherFilters();
        this.schedules = data.schedules;
        this.writeOffs = this.normalizeWriteOffList(data.writeOffs);
        this.ensurePayablesForWriteOffs(this.writeOffs).subscribe();
        this.banks = data.banks.content;
        this.bankOptions = this.banks.map((bank: any) => ({
          id: bank.id,
          label: `${bank.bank?.name || 'Banco'} - ${bank.accountNumber}`
        }));
        this.accounts = data.accounts.filter((a: any) => a.status !== false);
        this.accountingAccountLookup = buildAccountCatalogueLookup(
          flattenAccountCatalogueRefs(data.accountCatalogue || []).filter((a: any) => a.status !== false),
        );
        this.accountOptions = this.accounts.map((account: any) => ({
          id: account.id,
          label: `${account.code} - ${account.description}`
        }));
        const activeAccountIds = buildActiveAccountIdSet(data.accounts);
        this.allPaymentMethodsCount = data.methods.content?.length ?? 0;
        this.methods = filterSelectablePaymentMethods(
          data.methods.content,
          activeAccountIds,
          null,
        );
        this.methodOptions = this.methods.map((method) => ({
          id: method.id,
          label: translatePaymentMethodName(method.name),
        }));
        this.loadedEnterpriseId = enterpriseId;
        this.loaded = true;
        this.loading = false;
        this.busy = false;
      },
      error: () => {
        this.loadError = TreasuryOperationsComponent.LOAD_ERROR_MESSAGE;
        this.loading = false;
        this.busy = false;
      }
    });
  }

  setDialogLinePaymentMode(line: TreasuryOperationsComponent['dialogLines'][number], mode: 'full' | 'partial') {
    line.paymentMode = mode;
    if (mode === 'full') {
      line.amount = line.maxAmount;
    }
  }

  onDialogLineAmountChange(line: TreasuryOperationsComponent['dialogLines'][number]) {
    if (Number(line.amount) >= line.maxAmount) {
      line.paymentMode = 'full';
      line.amount = line.maxAmount;
    } else {
      line.paymentMode = 'partial';
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'POSTED':
      case 'SCHEDULED':
      case 'EXECUTED':
        return 'success';
      case 'DRAFT':
      case 'POSTING':
      case 'VOIDING':
        return 'info';
      case 'FAILED':
      case 'VOID_FAILED':
        return 'danger';
      case 'VOIDED':
      case 'CANCELLED':
        return 'secondary';
      default:
        return 'warning';
    }
  }

  hasActiveWriteOffForPayable(payable: Payable): boolean {
    return hasActiveWriteOffForInvoice(this.writeOffs, payable.id);
  }

  canWriteOffPayable(payable: Payable): boolean {
    return payable.active
      && Number(payable.availableAmount) > 0
      && !this.hasActiveWriteOffForPayable(payable)
      && !this.hasActivePaymentScheduleForPayable(payable);
  }

  writeOffPayableTooltip(payable: Payable): string | undefined {
    if (!payable.active || Number(payable.availableAmount) <= 0) {
      return WRITE_OFF_NO_AVAILABLE_BALANCE_MESSAGE;
    }
    if (this.hasActivePaymentScheduleForPayable(payable)) {
      return ACTIVE_PAYMENT_SCHEDULE_BLOCK_MESSAGE;
    }
    if (this.hasActiveWriteOffForPayable(payable)) {
      return WRITE_OFF_PENDING_BLOCK_MESSAGE;
    }
    return undefined;
  }

  payableAccountLabel(payable: Payable): string {
    const account = this.accounts.find(
      (item) => item.id === payable.payableAccountId || item.code === payable.payableAccountCode,
    );
    if (account) {
      return `${account.code} - ${account.description}`;
    }
    return payable.payableAccountCode ?? '—';
  }

  openWriteOffDialog(payable: Payable) {
    if (this.hasActivePaymentScheduleForPayable(payable)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Pago programado',
        detail: ACTIVE_PAYMENT_SCHEDULE_BLOCK_MESSAGE,
        life: 6000,
      });
      return;
    }
    if (this.hasActiveWriteOffForPayable(payable)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Baja pendiente',
        detail: WRITE_OFF_PENDING_BLOCK_MESSAGE,
        life: 6000,
      });
      return;
    }
    if (!payable.active || Number(payable.availableAmount) <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin saldo',
        detail: WRITE_OFF_NO_AVAILABLE_BALANCE_MESSAGE,
        life: 6000,
      });
      return;
    }
    this.writeOffTarget = payable;
    this.writeOffAmount = Number(payable.availableAmount);
    this.writeOffCounterpartAccountId = undefined;
    this.writeOffReason = '';
    this.writeOffDialogVisible = true;
  }

  cancelWriteOffDialog() {
    this.writeOffDialogVisible = false;
    this.writeOffTarget = undefined;
    this.writeOffAmount = undefined;
    this.writeOffCounterpartAccountId = undefined;
    this.writeOffReason = '';
  }

  confirmWriteOffFromDialog() {
    if (!this.writeOffTarget) {
      return;
    }
    if (!this.canWriteOffPayable(this.writeOffTarget)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin saldo',
        detail: WRITE_OFF_NO_AVAILABLE_BALANCE_MESSAGE,
        life: 6000,
      });
      return;
    }
    const amount = Number(this.writeOffAmount ?? 0);
    const maxAmount = Number(this.writeOffTarget.availableAmount);
    if (amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Monto inválido',
        detail: WRITE_OFF_AMOUNT_INVALID_MESSAGE,
        life: 5000,
      });
      return;
    }
    if (amount > maxAmount) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Monto excedido',
        detail: WRITE_OFF_AMOUNT_EXCEEDS_MESSAGE,
        life: 6000,
      });
      return;
    }
    const account = this.accounts.find((item) => item.id === Number(this.writeOffCounterpartAccountId));
    if (!account) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cuenta contrapartida',
        detail: WRITE_OFF_COUNTERPART_REQUIRED_MESSAGE,
        life: 5000,
      });
      return;
    }
    const accountCode = this.resolveAccountCode(account);
    if (!accountCode) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cuenta contrapartida',
        detail: 'La cuenta seleccionada no tiene código contable válido.',
        life: 5000,
      });
      return;
    }
    const reason = (this.writeOffReason ?? '').trim();
    if (!reason) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Motivo requerido',
        detail: WRITE_OFF_REASON_REQUIRED_MESSAGE,
        life: 5000,
      });
      return;
    }
    const payable = this.writeOffTarget;
    this.run(
      this.api.createWriteOff({
        enterpriseId: this.enterpriseId,
        reason,
        counterpartAccountId: account.id,
        counterpartAccountCode: accountCode,
        details: [{
          supplierId: payable.supplierId,
          invoiceId: payable.id,
          amount,
        }],
      }),
      (created) => {
        this.upsertWriteOff(created);
        this.cancelWriteOffDialog();
        this.scrollToWriteOffsSection();
        return {
          summary: 'Baja de CxP',
          detail: WRITE_OFF_CREATE_SUCCESS_MESSAGE,
          life: 8000,
        };
      },
    );
  }

  get dialogSelectedMethod(): any {
    return this.methods.find((method) => method.id === Number(this.dialogPaymentMethodId));
  }

  get dialogRequiresBankAccount(): boolean {
    return Boolean(this.dialogSelectedMethod?.requiresBankAccount);
  }

  get paymentDialogHeader(): string {
    return this.editingVoucherId ? 'Editar borrador' : 'Registrar pago';
  }

  get isEditingVoucher(): boolean {
    return this.editingVoucherId != null;
  }

  get dialogPaymentTotal(): number {
    return this.dialogLines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  }

  get dialogIsPartialPayment(): boolean {
    return this.dialogLines.some((line) => line.paymentMode === 'partial');
  }

  get dialogPayButtonLabel(): string {
    return this.dialogIsPartialPayment ? 'Pagar parcialmente' : 'Pagar total';
  }

  get dialogPaySuccessSummary(): string {
    return this.dialogIsPartialPayment ? 'Pago parcial registrado' : 'Pago total registrado';
  }

  get scheduleSelectedMethod(): any {
    return this.methods.find((method) => method.id === Number(this.schedulePaymentMethodId));
  }

  get scheduleRequiresBankAccount(): boolean {
    return Boolean(this.scheduleSelectedMethod?.requiresBankAccount);
  }

  get noActivePaymentMethods(): boolean {
    return this.methodOptions.length === 0;
  }

  get paymentMethodsHelpMessage(): string {
    return paymentMethodsAvailabilityMessage(this.allPaymentMethodsCount, this.methodOptions.length);
  }

  get dialogBankAccountsUnavailable(): boolean {
    return this.dialogRequiresBankAccount && this.bankOptions.length === 0;
  }

  get scheduleBankAccountsUnavailable(): boolean {
    return this.scheduleRequiresBankAccount && this.bankOptions.length === 0;
  }

  get cannotConfirmPaymentDialog(): boolean {
    return this.busy || this.noActivePaymentMethods || this.dialogBankAccountsUnavailable;
  }

  get cannotConfirmScheduleDialog(): boolean {
    return this.busy || this.noActivePaymentMethods || this.scheduleBankAccountsUnavailable;
  }

  get scheduleDialogTotal(): number {
    return this.scheduleLines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  }

  private buildPaymentLineFromPayable(payable: Payable): TreasuryOperationsComponent['dialogLines'][number] {
    return {
      invoiceId: payable.id,
      supplierId: payable.supplierId,
      reference: payable.reference,
      amount: Number(payable.availableAmount),
      maxAmount: Number(payable.availableAmount),
      paymentMode: 'full',
      payableAccountId: payable.payableAccountId,
      payableAccountCode: payable.payableAccountCode,
    };
  }

  openPaymentDialog(payable: Payable) {
    if (this.hasActivePaymentScheduleForPayable(payable)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Pago programado',
        detail: ACTIVE_PAYMENT_SCHEDULE_BLOCK_MESSAGE,
        life: 6000,
      });
      return;
    }
    if (this.noActivePaymentMethods) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Métodos de pago',
        detail: this.paymentMethodsHelpMessage,
        life: 8000,
      });
      return;
    }
    this.editingVoucherId = undefined;
    this.dialogPaymentMethodId = undefined;
    this.dialogBankAccountId = undefined;
    this.dialogObservations = '';
    this.dialogLines = [this.buildPaymentLineFromPayable(payable)];
    this.paymentDialogVisible = true;
  }

  edit(voucher: PaymentVoucher) {
    this.editingVoucherId = voucher.id;
    this.dialogPaymentMethodId = voucher.paymentMethodId;
    this.dialogBankAccountId = voucher.bankAccountId;
    this.dialogObservations = voucher.observations ?? '';
    this.dialogLines = voucher.details.map((detail) => {
      const payable = this.payables.find((item) => item.id === detail.invoiceId);
      const maxAmount = payable
        ? Number(payable.availableAmount) + Number(detail.amountPaid)
        : Number(detail.amountPaid);
      const amountPaid = Number(detail.amountPaid);
      return {
        invoiceId: detail.invoiceId,
        supplierId: detail.supplierId,
        reference: detail.invoiceReference,
        amount: amountPaid,
        maxAmount,
        paymentMode: amountPaid >= maxAmount ? 'full' as const : 'partial' as const,
        payableAccountId: detail.payableAccountId,
        payableAccountCode: detail.payableAccountCode,
      };
    });
    this.paymentDialogVisible = true;
  }

  openScheduleDialog(payable: Payable) {
    if (this.hasActivePaymentScheduleForPayable(payable)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Pago programado',
        detail: ACTIVE_PAYMENT_SCHEDULE_BLOCK_MESSAGE,
        life: 6000,
      });
      return;
    }
    if (this.noActivePaymentMethods) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Métodos de pago',
        detail: this.paymentMethodsHelpMessage,
        life: 8000,
      });
      return;
    }
    this.schedulePaymentMethodId = undefined;
    this.scheduleBankAccountId = undefined;
    this.scheduleObservations = '';
    this.scheduleExecutionDate = new Date(this.minExecutionDate);
    this.scheduleLines = [this.buildPaymentLineFromPayable(payable)];
    this.scheduleDialogVisible = true;
  }

  cancelScheduleDialog() {
    this.scheduleDialogVisible = false;
    this.scheduleLines = [];
    this.schedulePaymentMethodId = undefined;
    this.scheduleBankAccountId = undefined;
    this.scheduleExecutionDate = undefined;
    this.scheduleObservations = '';
  }

  schedulePaymentMethodChanged() {
    if (!this.scheduleRequiresBankAccount) {
      this.scheduleBankAccountId = undefined;
    }
  }

  onScheduleExecutionDateChange(selectedDate: Date | null) {
    if (!selectedDate) {
      return;
    }
    const today = this.stripTime(new Date());
    if (this.stripTime(selectedDate).getTime() <= today.getTime()) {
      this.scheduleExecutionDate = new Date(this.minExecutionDate);
      this.messageService.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: SCHEDULE_FUTURE_DATE_REQUIRED_MESSAGE,
        life: 5000,
      });
    }
  }

  cancelPaymentDialog() {
    this.paymentDialogVisible = false;
    this.editingVoucherId = undefined;
    this.dialogLines = [];
    this.dialogPaymentMethodId = undefined;
    this.dialogBankAccountId = undefined;
    this.dialogObservations = '';
  }

  dialogPaymentMethodChanged() {
    if (!this.dialogRequiresBankAccount) {
      this.dialogBankAccountId = undefined;
    }
  }

  confirmCreateFromDialog() {
    if (!this.validatePaymentAction(this.dialogLines, this.dialogPaymentMethodId, this.dialogBankAccountId)) {
      return;
    }
    const request = {
      enterpriseId: this.enterpriseId,
      issueDate: new Date().toISOString().slice(0, 10),
      paymentMethodId: this.dialogPaymentMethodId!,
      bankAccountId: this.dialogBankAccountId,
      observations: this.dialogObservations,
      details: this.getDialogDetails(),
    };
    const request$ = this.editingVoucherId
      ? this.api.updateVoucher(this.editingVoucherId, request)
      : this.api.createVoucher(request);
    this.run(
      request$,
      (result) => {
        const wasEditing = this.editingVoucherId != null;
        this.cancelPaymentDialog();
        return {
          summary: wasEditing ? 'Borrador actualizado' : 'Borrador creado',
          detail: `Comprobante ${result.voucherNumber} en borrador.`,
        };
      },
    );
  }

  confirmPayFromDialog() {
    if (!this.validatePaymentAction(this.dialogLines, this.dialogPaymentMethodId, this.dialogBankAccountId)) {
      return;
    }
    this.busy = true;
    this.error = '';
    this.api.createVoucher({
      enterpriseId: this.enterpriseId,
      issueDate: new Date().toISOString().slice(0, 10),
      paymentMethodId: this.dialogPaymentMethodId!,
      bankAccountId: this.dialogBankAccountId,
      observations: this.dialogObservations,
      details: this.getDialogDetails(),
    }).pipe(
      timeout(TreasuryOperationsComponent.OPERATION_TIMEOUT_MS),
      switchMap((voucher) =>
        this.api.postVoucher(voucher.id, this.enterpriseId).pipe(
          timeout(TreasuryOperationsComponent.OPERATION_TIMEOUT_MS),
        ),
      ),
      switchMap((posted) => this.waitForAccounting(posted.id)),
      finalize(() => {
        this.busy = false;
      }),
    ).subscribe({
      next: (updated) => {
        this.cancelPaymentDialog();
        if (updated.status === 'POSTED') {
          this.messageService.add({
            severity: 'success',
            summary: this.dialogPaySuccessSummary,
            detail: `${this.dialogPayButtonLabel} registrado. Comprobante ${updated.voucherNumber} contabilizado.`,
            life: 6000,
          });
        } else if (updated.status === 'FAILED') {
          this.error = updated.failureReason || 'No se pudo contabilizar el pago.';
          this.messageService.add({
            severity: 'error',
            summary: 'Pago fallido',
            detail: this.error,
            life: 8000,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Pago en proceso',
            detail: `El comprobante ${updated.voucherNumber} sigue en estado ${this.statusLabel(updated.status)}. Actualice en unos segundos.`,
            life: 8000,
          });
        }
        this.reload();
      },
      error: (err) => {
        this.handleOperationError(err, 'registrar el pago');
        this.reload();
      },
    });
  }

  confirmScheduleFromDialog() {
    if (!this.validatePaymentAction(
      this.scheduleLines,
      this.schedulePaymentMethodId,
      this.scheduleBankAccountId,
      { requireScheduleDate: true, executionDate: this.scheduleExecutionDate },
    )) {
      return;
    }
    this.run(
      this.api.createSchedule({
        enterpriseId: this.enterpriseId,
        executionDate: this.formatIsoDate(this.scheduleExecutionDate!),
        paymentMethodId: this.schedulePaymentMethodId!,
        bankAccountId: this.scheduleBankAccountId,
        observations: this.scheduleObservations,
        details: this.getScheduleDetails(),
      }),
      (result) => {
        const detail = this.buildScheduleSuccessDetail(result, this.scheduleLines);
        this.cancelScheduleDialog();
        return {
          summary: 'Pago programado',
          detail,
          life: 8000,
        };
      },
    );
  }

  private getDialogDetails() {
    return this.dialogLines.map((line) => ({
      supplierId: line.supplierId,
      invoiceId: line.invoiceId,
      amount: Number(line.amount),
    }));
  }

  private getScheduleDetails() {
    return this.scheduleLines.map((line) => ({
      supplierId: line.supplierId,
      invoiceId: line.invoiceId,
      amount: Number(line.amount),
    }));
  }

  scheduleTotal = scheduleTotal;

  scheduleSuppliersLabel(item: PaymentSchedule): string {
    return scheduleSuppliersLabel(item, this.supplierNames);
  }

  scheduleInvoicesLabel(item: PaymentSchedule): string {
    return scheduleInvoicesLabel(item, this.payableReferenceMap(), this.formatMoney);
  }

  scheduleMethodLabel(item: PaymentSchedule): string {
    return scheduleMethodLabel(item, this.methods);
  }

  scheduleTypeLabel = scheduleTypeLabel;
  formatTreasuryInstant = formatTreasuryInstant;

  scheduleVoucherLabel(item: PaymentSchedule): string {
    return scheduleVoucherLabel(item, this.voucherNumberById());
  }

  canCancelSchedule(item: PaymentSchedule): boolean {
    return item.status === 'SCHEDULED';
  }

  canViewScheduleVoucher(item: PaymentSchedule): boolean {
    return item.status === 'EXECUTED' && item.voucherId != null;
  }

  showScheduleDetail(item: PaymentSchedule) {
    this.scheduleDetailTarget = item;
    this.scheduleDetailDialogVisible = true;
  }

  cancelScheduleDetailDialog() {
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
      executionDate: item.executionDate,
      type: scheduleTypeLabel(item),
      supplier: scheduleSuppliersLabel(item, this.supplierNames),
      method: scheduleMethodLabel(item, this.methods),
      bank: this.scheduleBankLabel(item),
      total: this.scheduleTotal(item).toLocaleString('es-CO', { style: 'currency', currency: 'COP' }),
      statusLabel: scheduleStatusLabel(item.status),
      statusSeverity: this.getStatusSeverity(item.status),
      invoices: scheduleInvoicesLabel(item, this.payableReferenceMap(), (amount) =>
        amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })),
      showVoucher: this.canViewScheduleVoucher(item),
      voucher: scheduleVoucherLabel(item, this.voucherNumberById()),
    });
  }

  openScheduleVoucher(item: PaymentSchedule) {
    if (!item.voucherId) {
      return;
    }
    this.router.navigate(['/financial/treasury/expense-receipts/details', item.voucherId]);
  }

  private voucherNumberById(): Map<number, string> {
    return new Map(
      this.allVouchers
        .filter((voucher) => voucher.voucherNumber)
        .map((voucher) => [voucher.id, voucher.voucherNumber]),
    );
  }

  private payableReferenceMap(): Map<number, string> {
    return new Map(this.payables.map((payable) => [payable.id, payable.reference]));
  }

  scheduledAmountForPayable(payable: Payable): number {
    return this.blockingSchedules()
      .flatMap((schedule) => schedule.details ?? [])
      .filter((detail) => detail.invoiceId === payable.id && !detail.canceled)
      .reduce((sum, detail) => sum + Number(detail.amount ?? 0), 0);
  }

  scheduledLabelForPayable(payable: Payable): string | null {
    const linked = this.blockingSchedules().filter((schedule) =>
      (schedule.details ?? []).some((detail) => detail.invoiceId === payable.id && !detail.canceled),
    );
    if (!linked.length) {
      return null;
    }
    const amount = this.scheduledAmountForPayable(payable);
    const dates = [...new Set(linked.map((schedule) => schedule.executionDate))].join(', ');
    return `${this.formatMoney(amount)} · ${dates}`;
  }

  hasActivePaymentScheduleForPayable(payable: Payable): boolean {
    return this.blockingSchedules().some((schedule) =>
      (schedule.details ?? []).some((detail) => detail.invoiceId === payable.id && !detail.canceled),
    );
  }

  activePaymentScheduleTooltip(payable: Payable): string | undefined {
    return this.hasActivePaymentScheduleForPayable(payable)
      ? ACTIVE_PAYMENT_SCHEDULE_BLOCK_MESSAGE
      : undefined;
  }

  payableReference(invoiceId: number): string {
    const payable = this.payables.find((item) => item.id === invoiceId);
    return payable?.reference ?? `ID ${invoiceId}`;
  }

  private blockingSchedules(): PaymentSchedule[] {
    return this.schedules.filter((schedule) => schedule.status === 'SCHEDULED' || schedule.status === 'FAILED');
  }

  private buildScheduleSuccessDetail(
    result: PaymentSchedule,
    lines: TreasuryOperationsComponent['scheduleLines'],
  ): string {
    const total = this.resolveScheduleTotal(result, lines);
    const refs = lines.map((line) => line.reference).join(', ');
    const supplier = lines.length ? this.supplierName(lines[0].supplierId) : '—';
    const method = this.methods.find((item) => item.id === Number(result.paymentMethodId));
    const methodLabel = method ? translatePaymentMethodName(method.name) : `#${result.paymentMethodId}`;
    return [
      `Programación #${result.id} registrada.`,
      `Fecha: ${result.executionDate}.`,
      `Proveedor: ${supplier}.`,
      `Factura(s): ${refs || '—'}.`,
      `Método: ${methodLabel}.`,
      `Total: ${this.formatMoney(total)}.`,
      'Estado: PROGRAMADO.',
    ].join(' ');
  }

  private resolveScheduleTotal(
    result: PaymentSchedule,
    lines: TreasuryOperationsComponent['scheduleLines'],
  ): number {
    const apiTotal = result.total != null ? Number(result.total) : NaN;
    if (!Number.isNaN(apiTotal) && apiTotal > 0) {
      return apiTotal;
    }
    const detailsTotal = (result.details ?? []).reduce((sum, detail) => sum + Number(detail.amount ?? 0), 0);
    if (detailsTotal > 0) {
      return detailsTotal;
    }
    return lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  }

  private formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private validatePaymentAction(
    lines: TreasuryOperationsComponent['dialogLines'],
    paymentMethodId?: number,
    bankAccountId?: number,
    options?: { requireScheduleDate?: boolean; executionDate?: Date },
  ): boolean {
    if (!lines.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin obligaciones',
        detail: 'No hay obligaciones para procesar.',
        life: 5000,
      });
      return false;
    }
    for (const line of lines) {
      const amount = Number(line.amount ?? 0);
      if (amount <= 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Monto inválido',
          detail: `Indique un monto mayor a cero para ${line.reference}.`,
          life: 5000,
        });
        return false;
      }
      if (amount > line.maxAmount) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Saldo insuficiente',
          detail: `El monto para ${line.reference} supera el saldo disponible (${line.maxAmount}).`,
          life: 6000,
        });
        return false;
      }
    }
    if (this.methodOptions.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Métodos de pago',
        detail: this.paymentMethodsHelpMessage,
        life: 8000,
      });
      return false;
    }
    const selectedMethod = this.methods.find((method) => method.id === Number(paymentMethodId));
    if (!paymentMethodId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Método requerido',
        detail: 'Seleccione un método de pago activo.',
        life: 5000,
      });
      return false;
    }
    if (!selectedMethod) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Método de pago',
        detail: 'El método de pago seleccionado ya no está disponible.',
        life: 5000,
      });
      return false;
    }
    const requiresBankAccount = Boolean(selectedMethod?.requiresBankAccount);
    if (requiresBankAccount && !bankAccountId) {
      if (this.bankOptions.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Cuenta bancaria',
          detail: NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE,
          life: 6000,
        });
        return false;
      }
      this.messageService.add({
        severity: 'warn',
        summary: 'Cuenta bancaria requerida',
        detail: 'El método seleccionado exige una cuenta bancaria.',
        life: 5000,
      });
      return false;
    }
    if (!requiresBankAccount && bankAccountId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cuenta bancaria no permitida',
        detail: 'El método seleccionado no admite cuenta bancaria.',
        life: 5000,
      });
      return false;
    }
    if (options?.requireScheduleDate && !options.executionDate) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fecha requerida',
        detail: 'Seleccione la fecha programada del pago.',
        life: 5000,
      });
      return false;
    }
    if (options?.requireScheduleDate && options.executionDate) {
      const today = this.stripTime(new Date());
      if (this.stripTime(options.executionDate).getTime() <= today.getTime()) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Fecha inválida',
          detail: SCHEDULE_FUTURE_DATE_REQUIRED_MESSAGE,
          life: 5000,
        });
        return false;
      }
    }
    return true;
  }

  private waitForAccounting(voucherId: number) {
    return timer(0, TreasuryOperationsComponent.POST_POLL_INTERVAL_MS).pipe(
      take(TreasuryOperationsComponent.POST_POLL_MAX_ATTEMPTS),
      switchMap(() =>
        this.api.voucher(voucherId, this.enterpriseId).pipe(
          catchError(() => of(null)),
        ),
      ),
      filter((voucher): voucher is PaymentVoucher => voucher != null),
      takeWhile((voucher) => voucher.status === 'POSTING', true),
    );
  }

  post(voucher: PaymentVoucher) {
    if (!this.enterpriseId) {
      this.error = 'Seleccione una empresa activa.';
      return;
    }

    this.postingVoucherId = voucher.id;
    this.busy = true;
    this.error = '';

    this.api.postVoucher(voucher.id, this.enterpriseId).pipe(
      timeout(TreasuryOperationsComponent.OPERATION_TIMEOUT_MS),
      switchMap((posted) => this.waitForAccounting(posted.id)),
      finalize(() => {
        this.busy = false;
        this.postingVoucherId = undefined;
      }),
    ).subscribe({
      next: (updated) => {
        if (updated.status === 'POSTED') {
          this.messageService.add({
            severity: 'success',
            summary: 'Contabilizado',
            detail: `El comprobante ${updated.voucherNumber} quedó contabilizado.`,
            life: 6000,
          });
        } else if (updated.status === 'FAILED') {
          this.error = updated.failureReason || 'No se pudo contabilizar el comprobante.';
          this.messageService.add({
            severity: 'error',
            summary: 'Contabilización fallida',
            detail: this.error,
            life: 8000,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Contabilización en proceso',
            detail: `El comprobante ${updated.voucherNumber} sigue en estado ${this.statusLabel(updated.status)}. Actualice en unos segundos.`,
            life: 8000,
          });
        }
        this.reload();
      },
      error: (err) => {
        this.handleOperationError(err, 'contabilizar el comprobante');
        this.reload();
      },
    });
  }

  remove(voucher: PaymentVoucher) {
    this.run(this.api.deleteVoucher(voucher.id, this.enterpriseId));
  }

  void(voucher: PaymentVoucher) {
    const reason = window.prompt('Motivo de anulación');
    if (reason) {
      this.run(this.api.voidVoucher(voucher.id, this.enterpriseId, reason));
    }
  }

  get accountingIsBalanced(): boolean {
    return accountingTotalsBalanced(this.accountingDebitTotal, this.accountingCreditTotal);
  }

  showAccounting(voucher: PaymentVoucher) {
    this.busy = true;
    this.accountingEntry = null;
    this.accountingEntryHeader = {};
    this.accountingMovements = [];
    this.accountingDebitTotal = 0;
    this.accountingCreditTotal = 0;
    const accountLookup = this.accountingAccountLookup;
    const supplierIds = [...new Set(voucher.details.map((detail) => detail.supplierId))];
    const supplierLabel = supplierIds.map((id) => this.supplierName(id)).join(', ');

    this.api.accountingEntry(voucher.id).subscribe({
      next: (value) => {
        const entry = value?.data ?? value;
        const view = buildAccountingEntryView(
          entry as Record<string, unknown>,
          mapAccountingMovementsForView(entry?.movements ?? entry?.details ?? [], accountLookup),
          {
            documentTypeLabel: accountingSourceDocumentTypeLabel('PAYMENT_VOUCHER'),
            voucherNumber: voucher.voucherNumber,
            supplierLabel,
          },
        );
        this.accountingEntry = entry;
        this.accountingEntryHeader = view.header;
        this.accountingMovements = view.movements;
        this.accountingDebitTotal = this.accountingMovements.reduce((sum, row) => sum + row.debit, 0);
        this.accountingCreditTotal = this.accountingMovements.reduce((sum, row) => sum + row.credit, 0);
        this.busy = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'No fue posible consultar el asiento.';
        this.busy = false;
      },
    });
  }

  deschedule(schedule: PaymentSchedule) {
    this.run(this.api.cancelSchedule(schedule.id), () => ({
      summary: 'Pago desprogramado',
      detail: 'La programación pendiente fue eliminada correctamente.',
    }));
  }
  retry(schedule: PaymentSchedule) { this.run(this.api.retrySchedule(schedule.id)); }

  confirmWriteOff(item: PayableWriteOff) {
    const invoiceId = this.writeOffInvoiceId(item);
    this.busy = true;
    this.error = '';
    this.api.confirmWriteOff(item.id).pipe(
      timeout(TreasuryOperationsComponent.OPERATION_TIMEOUT_MS),
      switchMap((confirmed) => this.waitForWriteOffPosting(confirmed.id ?? item.id)),
      switchMap((updated) => forkJoin({
        payables: this.api.pending(this.enterpriseId).pipe(
          catchError(() => this.preserveDataAfterRefreshError(this.payables)),
        ),
        writeOffs: this.api.writeOffs(this.enterpriseId).pipe(
          catchError(() => this.preserveDataAfterRefreshError(this.writeOffs)),
        ),
      }).pipe(map((data) => ({ updated, ...data })))),
      finalize(() => {
        this.busy = false;
      }),
    ).subscribe({
      next: ({ updated, payables, writeOffs }) => {
        this.payables = payables;
        this.writeOffs = this.normalizeWriteOffList(writeOffs);
        this.ensurePayablesForWriteOffs(this.writeOffs).subscribe();
        if (updated.status === 'POSTED') {
          const stillPending = invoiceId != null
            ? payables.some((payable) => payable.id === invoiceId)
            : true;
          this.messageService.add({
            severity: 'success',
            summary: 'Baja contabilizada',
            detail: stillPending ? WRITE_OFF_POSTED_PARTIAL_MESSAGE : WRITE_OFF_POSTED_TOTAL_MESSAGE,
            life: 8000,
          });
        } else if (updated.status === 'FAILED') {
          this.error = WRITE_OFF_POST_FAILED_MESSAGE;
          this.messageService.add({
            severity: 'error',
            summary: 'Contabilización fallida',
            detail: WRITE_OFF_POST_FAILED_MESSAGE,
            life: 8000,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Contabilización en proceso',
            detail: `La baja sigue en estado ${this.writeOffLabel(updated.status)}. Actualice en unos segundos.`,
            life: 8000,
          });
        }
      },
      error: (err: unknown) => this.handleOperationError(err, 'contabilizar la baja de CxP'),
    });
  }

  discardDraftWriteOff(item: PayableWriteOff) {
    this.writeOffDiscardTarget = item;
    this.writeOffDiscardDialogVisible = true;
  }

  cancelDiscardWriteOffDialog() {
    this.writeOffDiscardDialogVisible = false;
    this.writeOffDiscardTarget = undefined;
  }

  confirmDiscardWriteOff() {
    const item = this.writeOffDiscardTarget;
    if (!item?.id) {
      return;
    }
    this.writeOffDiscardDialogVisible = false;
    this.writeOffDiscardTarget = undefined;
    this.run(this.api.discardWriteOff(item.id), () => ({
      summary: 'Borrador descartado',
      detail: WRITE_OFF_DISCARD_SUCCESS_MESSAGE,
      life: 8000,
    }));
  }

  voidWriteOff(item: PayableWriteOff) {
    this.busy = true;
    this.error = '';
    this.api.voidWriteOff(item.id).pipe(
      timeout(TreasuryOperationsComponent.OPERATION_TIMEOUT_MS),
      switchMap((voided) => {
        const writeOffId = voided.id ?? item.id;
        if (voided.status === 'VOIDING') {
          return this.waitForWriteOffVoiding(writeOffId);
        }
        return of(voided);
      }),
      switchMap((updated) => forkJoin({
        payables: this.api.pending(this.enterpriseId).pipe(
          catchError(() => this.preserveDataAfterRefreshError(this.payables)),
        ),
        writeOffs: this.api.writeOffs(this.enterpriseId).pipe(
          catchError(() => this.preserveDataAfterRefreshError(this.writeOffs)),
        ),
      }).pipe(map((data) => ({ updated, ...data })))),
      finalize(() => {
        this.busy = false;
      }),
    ).subscribe({
      next: ({ updated, payables, writeOffs }) => {
        this.payables = payables;
        this.writeOffs = this.normalizeWriteOffList(writeOffs);
        this.ensurePayablesForWriteOffs(this.writeOffs).subscribe();
        if (updated.status === 'VOIDED') {
          this.messageService.add({
            severity: 'success',
            summary: 'Baja anulada',
            detail: WRITE_OFF_VOIDED_MESSAGE,
            life: 8000,
          });
        } else if (updated.status === 'VOID_FAILED') {
          this.error = WRITE_OFF_VOID_FAILED_MESSAGE;
          this.messageService.add({
            severity: 'error',
            summary: 'Anulación fallida',
            detail: WRITE_OFF_VOID_FAILED_MESSAGE,
            life: 8000,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Anulación en proceso',
            detail: `La baja sigue en estado ${this.writeOffLabel(updated.status)}. Actualice en unos segundos.`,
            life: 8000,
          });
        }
      },
      error: (err: unknown) => this.handleOperationError(err, 'anular la baja de CxP'),
    });
  }

  private writeOffInvoiceId(item: PayableWriteOff): number | undefined {
    const detail = item.details?.[0];
    return detail?.invoiceId != null ? Number(detail.invoiceId) : undefined;
  }

  private findPayableForWriteOff(item: PayableWriteOff): Payable | undefined {
    const invoiceId = this.writeOffInvoiceId(item);
    if (invoiceId == null) {
      return undefined;
    }
    const cached = this.payableByInvoiceId.get(invoiceId);
    if (cached) {
      return cached;
    }
    return this.payables.find((entry) => entry.id === invoiceId);
  }

  private ensurePayablesForWriteOffs(writeOffs: PayableWriteOff[]): Observable<void> {
    const invoiceIds = [...new Set(
      writeOffs.flatMap((writeOff) =>
        (writeOff.details ?? [])
          .map((detail) => detail.invoiceId)
          .filter((invoiceId): invoiceId is number => invoiceId != null),
      ),
    )];
    const missing = invoiceIds.filter((invoiceId) =>
      !this.payables.some((payable) => payable.id === invoiceId)
      && !this.payableByInvoiceId.has(invoiceId),
    );
    if (!missing.length) {
      return of(void 0);
    }
    return forkJoin(
      missing.map((invoiceId) =>
        this.api.payable(invoiceId, this.enterpriseId).pipe(
          catchError(() => of(null)),
          map((payable) => {
            if (payable) {
              this.payableByInvoiceId.set(payable.id, payable);
            }
            return payable;
          }),
        ),
      ),
    ).pipe(map(() => void 0));
  }

  private waitForWriteOffPosting(writeOffId: number) {
    return timer(0, TreasuryOperationsComponent.POST_POLL_INTERVAL_MS).pipe(
      take(TreasuryOperationsComponent.POST_POLL_MAX_ATTEMPTS),
      switchMap(() => this.api.writeOff(writeOffId)),
      takeWhile((writeOff) => writeOff.status === 'POSTING', true),
    );
  }

  private waitForWriteOffVoiding(writeOffId: number) {
    return timer(0, TreasuryOperationsComponent.POST_POLL_INTERVAL_MS).pipe(
      take(TreasuryOperationsComponent.POST_POLL_MAX_ATTEMPTS),
      switchMap(() => this.api.writeOff(writeOffId)),
      takeWhile((writeOff) => writeOff.status === 'VOIDING', true),
    );
  }

  private resolveAccountCode(account: { code?: string; codeAccount?: string }): string {
    return String(account.code ?? account.codeAccount ?? '').trim();
  }

  private normalizeWriteOff(raw: PayableWriteOff | Record<string, unknown>): PayableWriteOff {
    const record = raw as Record<string, unknown>;
    const rawStatus = record['status'];
    const status = typeof rawStatus === 'string' ? rawStatus : 'DRAFT';
    const createdAt = typeof record['createdAt'] === 'string' ? record['createdAt'] : undefined;
    const accountingEntryCode = typeof record['accountingEntryCode'] === 'string'
      ? record['accountingEntryCode']
      : undefined;
    return {
      ...(raw as PayableWriteOff),
      id: Number(record['id']),
      total: Number(record['total'] ?? 0),
      status,
      createdAt,
      accountingEntryCode,
    };
  }

  private normalizeWriteOffList(items: PayableWriteOff[]): PayableWriteOff[] {
    return (items ?? []).map((item) => this.normalizeWriteOff(item));
  }

  private upsertWriteOff(raw: PayableWriteOff): void {
    if (!raw?.id) {
      return;
    }
    const item = this.normalizeWriteOff(raw);
    const index = this.writeOffs.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      this.writeOffs = [
        ...this.writeOffs.slice(0, index),
        item,
        ...this.writeOffs.slice(index + 1),
      ];
      return;
    }
    this.writeOffs = [item, ...this.writeOffs];
  }

  private scrollToWriteOffsSection(): void {
    setTimeout(() => {
      this.writeOffsSection?.nativeElement?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  openDueDateDialog(payable: Payable) {
    this.dueDateTarget = payable;
    this.newDueDate = this.parseIsoDate(payable.dueDate);
    this.dueDateReason = '';
    this.minDueDate = this.addDays(this.stripTime(new Date()), 1);
    if (this.newDueDate && this.stripTime(this.newDueDate).getTime() < this.minDueDate.getTime()) {
      this.newDueDate = new Date(this.minDueDate);
    }
    this.dueDateDialogVisible = true;
  }

  cancelDueDateDialog() {
    this.dueDateDialogVisible = false;
    this.dueDateTarget = undefined;
    this.newDueDate = undefined;
    this.dueDateReason = '';
  }

  onDueDatePickerChange(selectedDate: Date | null) {
    if (!selectedDate) {
      return;
    }
    if (this.stripTime(selectedDate).getTime() < this.minDueDate.getTime()) {
      this.newDueDate = new Date(this.minDueDate);
      this.messageService.add({
        severity: 'warn',
        summary: 'Vencimiento inválido',
        detail: 'La fecha debe ser posterior a hoy.',
        life: 4000,
      });
    }
  }

  confirmDueDateChange() {
    if (!this.dueDateTarget || !this.newDueDate) {
      return;
    }
    const reason = this.dueDateReason.trim();
    if (!reason) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Motivo requerido',
        detail: 'Indique el motivo del cambio de vencimiento.',
        life: 4000,
      });
      return;
    }
    if (this.stripTime(this.newDueDate).getTime() < this.minDueDate.getTime()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vencimiento inválido',
        detail: 'La fecha debe ser posterior a hoy.',
        life: 4000,
      });
      return;
    }
    const payable = this.dueDateTarget;
    const dueDate = this.formatIsoDate(this.newDueDate);
    this.cancelDueDateDialog();
    this.run(this.api.changeDueDate(payable.id, this.enterpriseId, dueDate, reason));
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private run(
    request: Observable<unknown>,
    onSuccess?: (result: any) => { summary: string; detail: string; life?: number },
  ) {
    this.busy = true;
    this.error = '';
    request.pipe(
      timeout(TreasuryOperationsComponent.OPERATION_TIMEOUT_MS),
      switchMap((result: any) => {
        if (onSuccess) {
          const message = onSuccess(result);
          this.messageService.add({
            severity: 'success',
            summary: message.summary,
            detail: message.detail,
            life: message.life ?? 6000,
          });
        }
        return this.api.writeOffs(this.enterpriseId).pipe(
          catchError(() => this.preserveDataAfterRefreshError(this.writeOffs)),
          switchMap((writeOffs) => {
            this.writeOffs = this.normalizeWriteOffList(writeOffs);
            return this.reloadCoreData();
          }),
        );
      }),
      finalize(() => {
        this.busy = false;
      }),
    ).subscribe({
      next: () => undefined,
      error: (err: unknown) => this.handleOperationError(err, 'completar la operación'),
    });
  }

  private reloadCoreData(): Observable<void> {
    return forkJoin({
      payables: this.api.pending(this.enterpriseId),
      vouchers: this.api.vouchers(this.enterpriseId, { size: 1000 }),
      schedules: this.api.schedules(this.enterpriseId),
      methods: this.paymentMethods.findAllActive(this.enterpriseId),
      banks: this.bankAccounts.findAllActive(this.enterpriseId),
      accounts: this.chart.getListAuxiliaryAccounts(this.enterpriseId),
      accountCatalogue: this.chart.getListAccounts(this.enterpriseId),
      thirds: this.thirds.getThirdParties(this.enterpriseId, 0, 1000),
    }).pipe(
      switchMap((data) => {
        this.payables = data.payables;
        this.supplierNames = buildThirdPartyNameMap(data.thirds?.content || []);
        this.allVouchers = data.vouchers.content;
        this.applyVoucherFilters();
        this.schedules = data.schedules;
        this.banks = data.banks.content;
        this.bankOptions = this.banks.map((bank: any) => ({
          id: bank.id,
          label: `${bank.bank?.name || 'Banco'} - ${bank.accountNumber}`,
        }));
        this.accounts = data.accounts.filter((a: any) => a.status !== false);
        this.accountingAccountLookup = buildAccountCatalogueLookup(
          flattenAccountCatalogueRefs(data.accountCatalogue || []).filter((a: any) => a.status !== false),
        );
        this.accountOptions = this.accounts.map((account: any) => ({
          id: account.id,
          label: `${account.code} - ${account.description}`,
        }));
        const activeAccountIds = buildActiveAccountIdSet(data.accounts);
        this.allPaymentMethodsCount = data.methods.content?.length ?? 0;
        this.methods = filterSelectablePaymentMethods(
          data.methods.content,
          activeAccountIds,
          null,
        );
        this.methodOptions = this.methods.map((method) => ({
          id: method.id,
          label: translatePaymentMethodName(method.name),
        }));
        return of(undefined);
      }),
      catchError(() => this.preserveDataAfterRefreshError(undefined)),
    );
  }

  private preserveDataAfterRefreshError<T>(currentData: T): Observable<T> {
    this.loadError = TreasuryOperationsComponent.LOAD_ERROR_MESSAGE;
    return of(currentData);
  }

  private handleOperationError(err: unknown, action: string): void {
    const timedOut = err instanceof TimeoutError;
    this.error = timedOut
      ? 'El servidor tardó demasiado en responder. Verifique el listado antes de reintentar.'
      : (err as any)?.error?.message ?? `No se pudo ${action}.`;
    this.messageService.add({
      severity: timedOut ? 'warn' : 'error',
      summary: timedOut ? 'Respuesta demorada' : 'Error',
      detail: this.error,
      life: 8000,
    });
  }

  get hasExportData(): boolean {
    return (
      this.payables.length > 0 ||
      this.vouchers.length > 0 ||
      this.schedules.length > 0 ||
      this.writeOffs.length > 0
    );
  }

  exportToCsv(): void {
    this.runExport('csv');
  }

  exportToPdf(): void {
    this.runExport('pdf');
  }

  private runExport(format: 'csv' | 'pdf'): void {
    if (!this.hasExportData) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: 'No hay información de operaciones para exportar.',
      });
      return;
    }

    const sections = this.buildExportSections();
    const filename = this.exportService.datedFilename('operaciones-tesoreria', format);
    const loadingFlag = format === 'csv' ? 'exportingCsv' : 'exportingPdf';
    this[loadingFlag] = true;

    try {
      if (format === 'csv') {
        this.exportService.downloadCsvSections(filename, sections);
      } else {
        this.exportService.downloadPdfSections('Operaciones de Tesorería', filename, sections);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'Exportado',
        detail: exportSuccessDetail('operaciones', format),
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

  private buildExportSections() {
    return [
      {
        title: 'Obligaciones pendientes',
        headers: ['Proveedor', 'Factura', 'Vence', 'Disponible', 'En programación'],
        rows: this.payables.map((item) => [
          resolveSupplierName(this.supplierNames, item.supplierId),
          item.reference,
          item.dueDate,
          item.availableAmount,
          this.scheduledLabelForPayable(item) ?? '-',
        ]),
      },
      {
        title: 'Comprobantes de pago',
        headers: ['Número', 'Fecha', 'Estado', 'Total', 'Asiento contable'],
        rows: this.vouchers.map((item) => [
          item.voucherNumber,
          item.issueDate,
          this.statusLabel(item.status),
          item.total,
          this.voucherAccountingEntryLabel(item),
        ]),
      },
      {
        title: 'Programaciones de pago',
        headers: ['Fecha ejecución', 'Proveedor', 'Factura(s)', 'Método', 'Estado', 'Total', 'Reintentos', 'Comprobante'],
        rows: this.schedules.map((item) => [
          item.executionDate,
          this.scheduleSuppliersLabel(item),
          this.scheduleInvoicesLabel(item),
          this.scheduleMethodLabel(item),
          this.scheduleLabel(item.status),
          this.scheduleTotal(item),
          item.retryCount,
          this.scheduleVoucherLabel(item),
        ]),
      },
      {
        title: 'Bajas de CxP',
        headers: ['N.º', 'Fecha', 'Proveedor', 'Factura / referencia', 'Total', 'Cuenta contrapartida', 'Estado'],
        rows: this.writeOffs.map((item) => [
          this.writeOffNumberLabel(item),
          this.writeOffDateLabel(item),
          this.writeOffSupplierLabel(item),
          this.writeOffInvoiceReference(item),
          item.total,
          this.writeOffCounterpartLabel(item),
          this.writeOffLabel(item.status),
        ]),
      },
    ];
  }
}
