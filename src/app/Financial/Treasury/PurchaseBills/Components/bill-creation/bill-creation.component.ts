import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

// PrimeNG Modules
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';

// Models and Services
import { PurchaseBillService } from '../../Services/purchase-bill.service';
import { PurchaseBillCreateRequest, ExpenseAccount } from '../../Models/PurchaseBill';
import { LocalStorageMethods } from '../../../../../Shared/Methods/local-storage.method';

interface Supplier {
  id: number;
  name: string;
  accountsPayableAccount: {
    id: number;
    code: string;
    name: string;
  };
}

@Component({
  selector: 'app-bill-creation',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    AutoCompleteModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextarea,
    TableModule,
    ToastModule,
    CardModule,
    DividerModule
  ],
  templateUrl: './bill-creation.component.html',
  styleUrls: ['./bill-creation.component.css'],
  providers: [MessageService]
})
export class BillCreationComponent implements OnInit {
  localStorageMethods = new LocalStorageMethods();

  // Forms
  billHeaderForm!: FormGroup;
  billLinesForm!: FormGroup;

  // Data for dropdowns and autocomplete
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  expenseAccounts: ExpenseAccount[] = [];

  // Calculations
  subtotal: number = 0;
  taxRate: number = 0.19; // 19% IVA por defecto
  taxes: number = 0;
  total: number = 0;

  // UI State
  isCreatingBill: boolean = false;
  showLineItems: boolean = false;

  constructor(
    private fb: FormBuilder,
    private purchaseBillService: PurchaseBillService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForms();
    this.loadInitialData();
    this.setupFormSubscriptions();

    // Agregar una línea inicial por defecto
    this.addLineItem();
  }

  initializeForms(): void {
    // Header form - similar a GnuCash bill header
    this.billHeaderForm = this.fb.group({
      billId: ['', [Validators.required]],
      dateOpened: [new Date(), [Validators.required]],
      supplier: [null, [Validators.required]],
      notes: ['']
    });

    // Line items form - similar a GnuCash line items
    this.billLinesForm = this.fb.group({
      lineItems: this.fb.array([])
    });
  }

  loadInitialData(): void {
    // Cargar siguiente número de factura
    this.purchaseBillService.getNextBillId().subscribe(billId => {
      this.billHeaderForm.patchValue({ billId });
    });

    // Cargar proveedores
    this.purchaseBillService.getSuppliers().subscribe(suppliers => {
      this.suppliers = suppliers;
      console.log('Proveedores cargados:', suppliers);
    });

    // Cargar cuentas de gastos
    this.purchaseBillService.getExpenseAccounts().subscribe(accounts => {
      this.expenseAccounts = accounts;
      console.log('Cuentas de gasto cargadas:', accounts);

      // Verificar que las cuentas tengan la estructura correcta
      if (accounts.length === 0) {
        console.warn('No se cargaron cuentas de gasto');
      }
    });
  }

  setupFormSubscriptions(): void {
    // Recalcular totales cuando cambien las líneas
    this.billLinesForm.valueChanges.subscribe(() => {
      this.calculateTotals();
    });
  }

  // Autocomplete de proveedores
  searchSupplier(event: any): void {
    const query = event.query;
    this.purchaseBillService.getSuppliers(query).subscribe(suppliers => {
      this.filteredSuppliers = suppliers;
    });
  }

  // Método para crear el bill header (similar al "New Bill" de GnuCash)
  onCreateBillHeader(): void {
    if (this.billHeaderForm.invalid) {
      this.billHeaderForm.markAllAsTouched();
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Validación',
        detail: 'Por favor, complete todos los campos requeridos del encabezado.'
      });
      return;
    }

    this.showLineItems = true;
    this.addLineItem(); // Agregar primera línea automáticamente

    this.messageService.add({
      severity: 'success',
      summary: 'Encabezado Creado',
      detail: 'Ahora puede agregar los elementos de línea de la factura.'
    });
  }

  // Manejo de líneas de la factura (line items)
  get lineItemsFormArray(): FormArray {
    return this.billLinesForm.get('lineItems') as FormArray;
  }

  addLineItem(): void {
    const lineItemForm = this.fb.group({
      date: [new Date(), [Validators.required]],
      description: ['', [Validators.required]],
      expenseAccount: [null, [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
      lineTotal: [{ value: 0, disabled: true }]
    });

    // Calcular total de línea cuando cambien cantidad o precio
    lineItemForm.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateLineTotal(lineItemForm);
    });

    lineItemForm.get('unitPrice')?.valueChanges.subscribe(() => {
      this.calculateLineTotal(lineItemForm);
    });

    // Debug: Log cuando cambie la cuenta de gasto
    lineItemForm.get('expenseAccount')?.valueChanges.subscribe((value) => {
      console.log('Cuenta de gasto seleccionada:', value);
      if (value) {
        const selectedAccount = this.expenseAccounts.find(acc => acc.id === value);
        console.log('Cuenta encontrada:', selectedAccount);
      }
    });

    this.lineItemsFormArray.push(lineItemForm);
    console.log('Línea agregada. Total líneas:', this.lineItemsFormArray.length);
  }

  removeLineItem(index: number): void {
    this.lineItemsFormArray.removeAt(index);
    this.calculateTotals();
  }

  calculateLineTotal(lineForm: FormGroup): void {
    const quantity = lineForm.get('quantity')?.value || 0;
    const unitPrice = lineForm.get('unitPrice')?.value || 0;
    const lineTotal = quantity * unitPrice;

    lineForm.get('lineTotal')?.setValue(lineTotal);
    this.calculateTotals();
  }

  calculateTotals(): void {
    this.subtotal = 0;

    this.lineItemsFormArray.controls.forEach(control => {
      const lineTotal = control.get('lineTotal')?.value || 0;
      this.subtotal += lineTotal;
    });

    this.taxes = this.subtotal * this.taxRate;
    this.total = this.subtotal + this.taxes;
  }

  // Validación completa del formulario
  isFormValid(): boolean {
    return this.billHeaderForm.valid &&
           this.billLinesForm.valid &&
           this.lineItemsFormArray.length > 0;
  }

  // Guardar la factura
  onSaveBill(): void {
    if (!this.isFormValid()) {
      this.billHeaderForm.markAllAsTouched();
      this.billLinesForm.markAllAsTouched();

      this.messageService.add({
        severity: 'error',
        summary: 'Error de Validación',
        detail: 'Por favor, complete todos los campos requeridos.'
      });
      return;
    }

    this.isCreatingBill = true;

    const headerData = this.billHeaderForm.value;
    const lineItemsData = this.lineItemsFormArray.value;

    const billData: PurchaseBillCreateRequest = {
      billId: headerData.billId,
      dateOpened: headerData.dateOpened,
      supplierId: headerData.supplier.id,
      subtotal: this.subtotal,
      taxes: this.taxes,
      total: this.total,
      notes: headerData.notes,
      enterpriseId: this.localStorageMethods.getIdEnterprise(),
      lineItems: lineItemsData.map((item: any) => ({
        date: item.date,
        description: item.description,
        expenseAccountId: item.expenseAccount.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    };

    this.purchaseBillService.createPurchaseBill(billData).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Factura ${response.billId} creada correctamente.`
        });

        // Redirigir al listado después de un breve retraso
        setTimeout(() => {
          this.router.navigate(['/financial/treasury/purchase-bills']);
        }, 2000);
      },
      error: (error) => {
        console.error('Error al crear la factura:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Ocurrió un error al crear la factura. Intente nuevamente.'
        });
        this.isCreatingBill = false;
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/financial/treasury/purchase-bills']);
  }

  // Helper para mostrar nombres de cuentas
  getAccountDisplayName(account: ExpenseAccount): string {
    return account ? account.fullName : '';
  }

  // Helper para formatear moneda
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}
