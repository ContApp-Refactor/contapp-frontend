import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { InputTextarea } from 'primeng/inputtextarea';
import { MessagesModule } from 'primeng/messages';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { Router, ActivatedRoute } from '@angular/router';
import { ExpenseReceipt } from '../../Model/ExpenseReceipt';
import { ExpenseReceiptDetail } from '../../Model/ExpenseReceiptDetail';
import { PaymentMethodsServiceService } from '../../../../../GeneralMasters/PaymentMethods/services/payment-methods-service.service';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';
import { PaymentMethod } from '../../../../../GeneralMasters/PaymentMethods/models/PaymentMethods';
import { ExpenseReceiptService } from '../../Service/expense-receipt.service';
import { PurchaseInvoice } from '../../Model/Models';
import { ExpenseReceiptCreateRequest } from '../../Model/ExpenseReceiptCreateRequest';
import { ChartAccountService } from '../../../../../GeneralMasters/AccountCatalogue/services/chart-account.service';
import { BankAccountsService, BankAccount } from '../../../../../GeneralMasters/BankAccounts/services/bank-accounts.service';
import { forkJoin } from 'rxjs';
import {
  buildActiveAccountIdSet,
  filterSelectablePaymentMethods,
} from '../../../Shared/treasury-account.integration';
import { translatePaymentMethodName } from '../../../Shared/treasury-status-labels';
import { ContextualHelpComponent } from '../../../../../Shared/Components/contextual-help/contextual-help.component';
import { TREASURY_HELP } from '../../../Shared/treasury-help-content';
import {
  NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE,
  paymentMethodsAvailabilityMessage,
} from '../../../Shared/treasury-payment-messages';

// Modelos adicionales para el frontend
interface DropdownOption {
  label: string;
  value: string;
}

interface Supplier {
  id: number;
  name: string;
  // Otros campos relevantes del proveedor
}

@Component({
  selector: 'app-expense-receipt-creation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule,
    DropdownModule,
    AutoCompleteModule,
    CalendarModule,
    InputNumberModule,
    InputTextarea,
    ButtonModule,
    TableModule,
    CheckboxModule,
    DialogModule,
    MessagesModule,
    FormsModule,
    CardModule,
    ContextualHelpComponent,
  ],
  templateUrl: './expense-receipt-creation.component.html',
  styleUrl: './expense-receipt-creation.component.css',
  providers: [MessageService]
})
export class ExpenseReceiptCreationComponent {
  localStorageMethods = new LocalStorageMethods();

  expenseReceiptForm!: FormGroup;
  receiptTypes: DropdownOption[] = [];
  paymentMethods: PaymentMethod[] = [];
  paymentMethodOptions: { id: number; label: string; requiresBankAccount: boolean }[] = [];
  allPaymentMethodsCount = 0;
  bankAccounts: BankAccount[] = [];
  bankAccountOptions: { id: number; label: string }[] = [];
  receiptTypeOptions: DropdownOption[] = [];
  auxiliaryAccounts: DropdownOption[] = [];
  requiresBankAccount = false;
  readonly help = TREASURY_HELP.makePayment;
  readonly noAvailableBankAccountsMessage = NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE;
  readonly supplierEmptyMessage = 'No hay proveedores con facturas pendientes';
  readonly supplierFilterEmptyMessage = 'No se encontraron proveedores que coincidan con la búsqueda';
  supplierSearchQuery = '';
  allSuppliersCount = 0;

  get paymentMethodsHelpMessage(): string {
    return paymentMethodsAvailabilityMessage(this.allPaymentMethodsCount, this.paymentMethodOptions.length);
  }

  // Para Autocomplete de Proveedor
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];

  // Para facturas disponibles del proveedor seleccionado
  availableInvoices: any[] = [];

  // Para selección múltiple de facturas
  selectedInvoices: any[] = [];

  // Detalles de la factura seleccionada
  selectedInvoiceDetails: any = null;

  totalAmount: number = 0;

  // Payment information from bill
  billPaymentInfo: {
    billId?: number;
    billCode?: string;
    supplierId?: number;
    supplierName?: string;
    totalAmount?: number;
    paidAmount?: number;
    pendingBalance?: number;
  } = {};

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private router: Router,
    private route: ActivatedRoute,
    private paymentMethodService: PaymentMethodsServiceService,
    private expenseReceiptService: ExpenseReceiptService,
    private chartAccountService: ChartAccountService,
    private bankAccountsService: BankAccountsService
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.loadDropdownOptions();
    this.expenseReceiptService.getSuppliers('').subscribe((suppliers) => {
      this.allSuppliersCount = suppliers.length;
    });
    this.updateTotalAmount();
    this.subscribeToFormChanges();

    this.route.queryParams.subscribe((params) => {
      const billId = params['billId'] || params['invoiceId'];
      if (!billId) return;

      this.billPaymentInfo = {
        billId: +billId,
        billCode: params['billCode'] || params['reference'],
        supplierId: params['supplierId'] ? +params['supplierId'] : undefined,
        supplierName: params['supplierName'],
        totalAmount: params['totalAmount'] ? +params['totalAmount'] : undefined,
        paidAmount: params['paidAmount'] ? +params['paidAmount'] : 0,
        pendingBalance: params['pendingBalance'] ? +params['pendingBalance'] : undefined,
      };
      this.prefillFormWithBillInfo();
    });
  }

  initializeForm(): void {
    this.expenseReceiptForm = this.fb.group({
      supplier: [null, Validators.required],
      transferAccount: [null, Validators.required],
      bankAccountId: [null],
      issueDate: [new Date(), Validators.required],
      totalAmount: [0, [Validators.required, Validators.min(0.01)]],
      observations: [''],
      auxiliaryAccount: [null], // Solo requerido si es gasto directo
      isPartialPayment: [false]
    });
  }

  // Validator for partial payment / overpay UX (backend also rejects with 409)
  validatePaymentAmount(): boolean {
    const totalAmount = Number(this.expenseReceiptForm.get('totalAmount')?.value || 0);
    const fromBill = Number(this.billPaymentInfo.pendingBalance || 0);
    const fromSelection = this.selectedInvoices.reduce(
      (sum, inv) => sum + Number(inv.pendingBalance || 0),
      0,
    );
    const pendingBalance = fromBill > 0 ? fromBill : fromSelection;

    if (pendingBalance > 0 && totalAmount > pendingBalance + 0.001) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Monto Excedido',
        detail: `El monto del pago (${this.formatCurrency(totalAmount)}) no puede exceder el saldo pendiente (${this.formatCurrency(pendingBalance)}).`
      });
      return false;
    }

    return true;
  }

  loadDropdownOptions(): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    if (!enterpriseId) {
      this.messageService.add({ severity: 'error', summary: 'Empresa requerida', detail: 'Seleccione una empresa activa.' });
      return;
    }

    // Métodos de pago con cuenta contable activa en catálogo
    forkJoin({
      methods: this.paymentMethodService.findAllActive(enterpriseId),
      accounts: this.chartAccountService.getListAuxiliaryAccounts(enterpriseId),
    }).subscribe({
      next: ({ methods, accounts }) => {
        const activeAccountIds = buildActiveAccountIdSet(accounts);
        const configured = (methods.content || []).filter((method) => method.status !== false);
        this.allPaymentMethodsCount = configured.length;
        this.paymentMethods = filterSelectablePaymentMethods(
          configured,
          activeAccountIds,
        );
        this.paymentMethodOptions = this.paymentMethods.map((method) => ({
          id: method.id!,
          label: `${translatePaymentMethodName(method.name)} (${method.accountingAccount})`,
          requiresBankAccount: Boolean(method.requiresBankAccount),
        }));
        if (this.paymentMethodOptions.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Métodos de pago',
            detail: this.paymentMethodsHelpMessage,
            life: 8000,
          });
        }
      },
      error: (error) => {
        console.error('Error al cargar métodos de pago:', error);
        this.paymentMethods = [];
        this.paymentMethodOptions = [];
        this.messageService.add({
          severity: 'error',
          summary: 'Métodos de pago',
          detail: 'No se pudieron cargar los métodos de pago de la empresa.',
        });
      },
    });

    // Cuentas bancarias reales (para Cheque / Transferencia)
    this.bankAccountsService.findAllActive(enterpriseId).subscribe({
      next: (page) => {
        this.bankAccounts = page.content || [];
        this.bankAccountOptions = this.bankAccounts.map((bank: any) => ({
          id: bank.id,
          label: `${bank.bank?.name || 'Banco'} - ${bank.accountNumber}`,
        }));
      },
      error: (error) => {
        console.error('Error al cargar cuentas bancarias:', error);
        this.bankAccounts = [];
        this.bankAccountOptions = [];
      }
    });

    // Cargar cuentas auxiliares para gastos directos
    this.expenseReceiptService.getAuxiliaryAccounts().subscribe(data => {
      this.auxiliaryAccounts = data;
    });
  }

  onPaymentMethodChange(): void {
    const methodId = this.expenseReceiptForm.get('transferAccount')?.value;
    const method = this.paymentMethods.find(m => m.id === methodId);
    this.requiresBankAccount = Boolean(method?.requiresBankAccount);

    const bankCtrl = this.expenseReceiptForm.get('bankAccountId');
    if (this.requiresBankAccount) {
      bankCtrl?.setValidators([Validators.required]);
    } else {
      bankCtrl?.clearValidators();
      bankCtrl?.setValue(null);
    }
    bankCtrl?.updateValueAndValidity();
  }

  subscribeToFormChanges(): void {
    // Los cambios se manejan directamente en los métodos onSupplierSelect y onInvoiceSelect
  }

  // Pre-fill form when coming from bill payment
  prefillFormWithBillInfo(): void {
    if (!this.billPaymentInfo.billId) return;

    const supplierId = this.billPaymentInfo.supplierId;
    if (!supplierId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Proveedor requerido',
        detail: 'No se pudo precargar el proveedor de la factura. Selecciónelo manualmente.',
      });
      return;
    }

    this.expenseReceiptService.getSupplierById(supplierId).subscribe((supplier) => {
      const resolved = supplier || {
        id: supplierId,
        name: this.billPaymentInfo.supplierName || `Proveedor ${supplierId}`,
        accountsPayableAccount: { id: 0, code: '', name: '' },
      };

      this.expenseReceiptForm.patchValue({
        supplier: resolved,
        totalAmount: this.billPaymentInfo.pendingBalance ?? this.billPaymentInfo.totalAmount ?? 0,
      });

      this.expenseReceiptService.getInvoicesBySupplier(supplierId).subscribe((invoices) => {
        this.availableInvoices = invoices.map((invoice) => ({
          id: invoice.id,
          billId: invoice.factCode,
          date: invoice.expirationDate,
          total: invoice.pendingValue,
          paidAmount: 0,
          pendingBalance: invoice.pendingValue,
          payableAccountId: invoice.payableAccountId,
          displayText: `${invoice.factCode} - ${this.formatCurrency(invoice.pendingValue)}`,
        }));

        const target =
          this.availableInvoices.find((inv) => inv.id === this.billPaymentInfo.billId) ||
          this.availableInvoices.find((inv) => inv.billId === this.billPaymentInfo.billCode);

        this.selectedInvoices = target ? [target] : [];
        this.onInvoiceSelectionChange();
      });
    });

    if (this.billPaymentInfo.paidAmount && this.billPaymentInfo.paidAmount > 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Pago parcial',
        detail: `Esta factura ya tiene un pago de ${this.formatCurrency(this.billPaymentInfo.paidAmount)}. Saldo pendiente: ${this.formatCurrency(this.billPaymentInfo.pendingBalance || 0)}`,
      });
    }
  }

  // Autocompletado de proveedores
  searchSupplier(event: any): void {
    this.supplierSearchQuery = String(event.query || '').trim();
    this.expenseReceiptService.getSuppliers(this.supplierSearchQuery).subscribe((data) => {
      this.filteredSuppliers = data;
      if (!this.supplierSearchQuery) {
        this.allSuppliersCount = data.length;
      }
    });
  }

  get supplierAutocompleteEmptyMessage(): string {
    if (this.allSuppliersCount === 0) {
      return this.supplierEmptyMessage;
    }
    return this.supplierFilterEmptyMessage;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Cuando selecciona un proveedor
  onSupplierSelect(event: any): void {
    const supplier = event.value || event;
    if (supplier && supplier.id) {
      this.loadInvoicesForSupplier(supplier.id);
    }
  }

  // Cargar facturas del proveedor seleccionado
  loadInvoicesForSupplier(supplierId: number): void {
    // Las obligaciones disponibles provienen de la réplica de Tesorería.
    this.expenseReceiptService.getInvoicesBySupplier(supplierId).subscribe(invoices => {
      this.availableInvoices = invoices.map(invoice => ({
        id: invoice.id,
        billId: invoice.factCode,
        date: invoice.expirationDate,
        total: invoice.pendingValue,
        paidAmount: 0,
        pendingBalance: invoice.pendingValue,
        payableAccountId: invoice.payableAccountId,
        displayText: `${invoice.factCode} - ${this.formatCurrency(invoice.pendingValue)}`
      }));
    });

    // Limpiar selección anterior
    this.selectedInvoices = [];
    this.selectedInvoiceDetails = null;
    this.expenseReceiptForm.patchValue({ totalAmount: 0 });
  }

  // Calcular el total de las facturas seleccionadas
  calculateSelectedTotal(): number {
    return this.selectedInvoices.reduce((sum, invoice) => sum + (invoice.pendingBalance || 0), 0);
  }

  // Actualizar el monto total cuando cambia la selección
  onInvoiceSelectionChange(): void {
    const totalSelected = this.calculateSelectedTotal();
    this.expenseReceiptForm.get('totalAmount')?.setValue(totalSelected);
  }

  // Obtener el nombre del método de pago seleccionado
  getPaymentMethodName(): string {
    const methodId = this.expenseReceiptForm.get('transferAccount')?.value;
    if (!methodId) return '';

    const option = this.paymentMethodOptions.find(m => m.id === methodId);
    if (!option) return '';

    if (this.requiresBankAccount) {
      const bankId = this.expenseReceiptForm.get('bankAccountId')?.value;
      const bank = this.bankAccountOptions.find(b => b.id === bankId);
      return bank ? `${option.label} · ${bank.label}` : option.label;
    }

    return option.label;
  }

  // Obtener los IDs de las facturas seleccionadas como string
  getSelectedBillIds(): string {
    return this.selectedInvoices.map(inv => inv.billId).join(', ');
  }

  updateTotalAmount(): void {
    // El total se actualiza automáticamente al seleccionar la factura
    this.totalAmount = this.expenseReceiptForm?.get('totalAmount')?.value || 0;
  }

  isFormValidForSubmission(): boolean {
    if (this.selectedInvoices.length === 0) {
      return false;
    }

    if (this.paymentMethodOptions.length === 0) {
      return false;
    }

    if (!this.requiresBankAccount && this.expenseReceiptForm.get('bankAccountId')?.value) {
      return false;
    }

    if (this.requiresBankAccount && this.bankAccountOptions.length === 0) {
      return false;
    }

    const basicValidation = this.expenseReceiptForm.get('supplier')?.valid &&
                           this.expenseReceiptForm.get('transferAccount')?.valid &&
                           this.expenseReceiptForm.get('issueDate')?.valid &&
                           this.expenseReceiptForm.get('totalAmount')?.valid &&
                           (!this.requiresBankAccount || this.expenseReceiptForm.get('bankAccountId')?.valid);

    return basicValidation || false;
  }

  onSubmit(): void {
    this.expenseReceiptForm.markAllAsTouched();

    if (this.paymentMethodOptions.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Métodos de pago',
        detail: this.paymentMethodsHelpMessage,
        life: 8000,
      });
      return;
    }

    // Validar selección de facturas
    if (this.selectedInvoices.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Selección Requerida',
        detail: 'Debe seleccionar al menos una factura para pagar.'
      });
      return;
    }

    if (!this.validatePaymentAmount()) {
      return;
    }

    if (!this.isFormValidForSubmission()) {
      const bankValue = this.expenseReceiptForm.get('bankAccountId')?.value;
      let detail = 'Por favor, complete todos los campos requeridos.';
      if (this.requiresBankAccount && this.bankAccountOptions.length === 0) {
        detail = NO_AVAILABLE_BANK_ACCOUNTS_MESSAGE;
      } else if (this.requiresBankAccount && !bankValue) {
        detail = 'El método de pago exige una cuenta bancaria.';
      } else if (!this.requiresBankAccount && bankValue) {
        detail = 'El método seleccionado no admite cuenta bancaria.';
      }
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Validación',
        detail,
      });
      return;
    }

    const formValue = this.expenseReceiptForm.value;
    const supplier: Supplier = formValue.supplier;
    const enterpriseId = this.localStorageMethods.getIdEnterprise();

    if (!enterpriseId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Configuración',
        detail: 'No se encontró el identificador de la empresa. Por favor, inicie sesión de nuevo.'
      });
      return;
    }

    // Construir los detalles de pago para cada factura seleccionada
    const paymentDetails = this.selectedInvoices.map(invoice => ({
      invoiceId: invoice.id,
      amountPaid: invoice.pendingBalance // Pagar el saldo pendiente completo
    }));

    // Construir el objeto de solicitud para la API
    const requestData: ExpenseReceiptCreateRequest = {
      thirdPartyId: supplier.id,
      paymentMethodId: formValue.transferAccount,
      bankAccountId: this.requiresBankAccount ? formValue.bankAccountId : null,
      receiptTypeId: 1, // Siempre es pago de factura
      observations: formValue.observations || `Pago de ${this.selectedInvoices.length} ${this.selectedInvoices.length === 1 ? 'factura' : 'facturas'}: ${this.selectedInvoices.map(inv => inv.billId).join(', ')}`,
      enterpriseId: enterpriseId,
      totalAmount: formValue.totalAmount,
      details: paymentDetails,
    };

    // Mostrar resumen antes de enviar
    const billIds = this.selectedInvoices.map(inv => inv.billId).join(', ');
    console.log('Creando comprobante de egreso para:', billIds);
    console.log('Total a pagar:', this.formatCurrency(formValue.totalAmount));

    // Enviar la solicitud al backend
    this.expenseReceiptService.createExpenseReceipt(requestData).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Comprobante de egreso ${response.receiptCode} creado correctamente para ${this.selectedInvoices.length} factura(s).`
        });

        // Redirigir al listado después de un breve retraso
        setTimeout(() => {
          this.router.navigate(['/financial/treasury/expense-receipts']);
        }, 2000);
      },
      error: (error) => {
        console.error('Error al crear el comprobante de egreso:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error?.error?.message || 'Ocurrió un error al crear el comprobante de egreso. Intente nuevamente.'
        });
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/financial/treasury/expense-receipts']);
  }
}
