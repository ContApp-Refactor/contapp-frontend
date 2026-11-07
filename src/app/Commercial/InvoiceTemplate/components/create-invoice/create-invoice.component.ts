import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { Facture2 } from '../../models/Facture2';
import { Product2, ProductList2 } from '../../models/Product2';
import { SteletonService } from '../../services/steleton.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ProductResponse } from '../../../BusinessMasters/ValuationModels/WeightedAverage/models/ProductResponse';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { Observable } from 'rxjs';


interface AutoCompleteCompleteEvent {
    originalEvent: Event;
    query: string;
}

interface InvoiceType {
  label: string;
  value: string;
}

@Component({
  selector: 'app-create-invoice',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    InputNumberModule,
    MessageModule,
    ToastModule,
    DatePickerModule,
    AutoCompleteModule
  ],
  providers: [MessageService],
  templateUrl: './create-invoice.component.html',
  styleUrl: './create-invoice.component.css'
})
export class CreateInvoiceComponent implements OnInit {
  invoiceForm: FormGroup;
  localStorageMethods: LocalStorageMethods = new LocalStorageMethods();
  entData: any | null = null;
  selectedInvoiceType: string = '';

  productId: number = 0;
  totalRecords = 0;
  first = 0;
  allProducts: ProductList2[] = [];
  filteredProducts: ProductList2[] = [];
  selectedProduct: ProductList2 | undefined;
  currentProductIndex: number = 0;

  invoiceTypes: InvoiceType[] = [
    { label: 'Factura de Compra', value: 'PURCHASE' },
    { label: 'Factura de Venta', value: 'SALE' }
  ];

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private messageService: MessageService,
    private steletonService: SteletonService,

  ) {
    this.invoiceForm = this.createInvoiceForm();
  }

  ngOnInit(): void {
    console.log('Componente de creación de factura inicializado');
    this.entData = this.localStorageMethods.loadEnterpriseData();
    console.log('Datos de empresa cargados:', this.entData);

    // Suscribirse a cambios en el total pagado para calcular el valor pendiente
    this.invoiceForm.get('totalPay')?.valueChanges.subscribe(() => {
      this.calculatePendingValue();
    });

    // Cargar todos los productos
    this.steletonService.getAllProductsByEnterpriseId().subscribe({
      next: (response) => {
        this.allProducts = response.content; // Extraer el array de productos del objeto paginado
        console.log('Productos cargados:', this.allProducts);
      },
      error: (error) => {
        console.error('Error al cargar productos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los productos'
        });
      }
    });
  }

  private createInvoiceForm(): FormGroup {
    const randomFactCode = Math.floor(Math.random() * 10000) + 1;

    return this.formBuilder.group({
      invoiceType: ['', Validators.required],
      factCode: [{ value: randomFactCode, disabled: true }, Validators.required],
      thId: ['', Validators.required],
      expirationDate: ['', Validators.required],
      accountingAccount: ['', Validators.required],
      factProducts: this.formBuilder.array([this.createProductForm()]),
      totalValue: [{ value: '', disabled: true }],
      totalPay: ['', Validators.required],
      pendingValue: [{ value: '', disabled: true }]
    });
  }

  private createProductForm(): FormGroup {
    const productForm = this.formBuilder.group({
      productId: [this.productId || '', Validators.required],
      amount: ['', [Validators.required, Validators.min(1)]],
      description: ['', Validators.required],
      discount: [0, [Validators.min(0), Validators.max(100)]], // Cambiado de 'descount' a 'discount'
      unitPrice: [0, [Validators.required, Validators.min(0)]], // Siempre requerido
      subtotal: [{ value: 0, disabled: true }],
      taxPercentage: [[]],
      taxPercentageInput: ['']
    });

    // Suscribirse a cambios para calcular subtotal
    productForm.get('amount')?.valueChanges.subscribe(() => this.calculateSubtotal(productForm));
    productForm.get('unitPrice')?.valueChanges.subscribe(() => this.calculateSubtotal(productForm));
    productForm.get('discount')?.valueChanges.subscribe(() => this.calculateSubtotal(productForm));

    console.log('Nuevo formulario de producto creado:', productForm.value);
    return productForm;
  }

  get factProducts(): FormArray {
    return this.invoiceForm.get('factProducts') as FormArray;
  }

  getProductControls() {
    return this.factProducts.controls;
  }

  onInvoiceTypeChange(event: any): void {
    this.selectedInvoiceType = event.value;
  }

  addProduct(): void {
    const newProduct = this.createProductForm();
    this.factProducts.push(newProduct);
  }

  removeProduct(index: number): void {
    if (this.factProducts.length > 1) {
      this.factProducts.removeAt(index);
      this.calculateTotalValue();
    }
  }

  updateTaxPercentages(index: number): void {
    const product = this.factProducts.at(index);
    const taxInput = product.get('taxPercentageInput')?.value;

    if (taxInput) {
      const percentages = taxInput.split(',').map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
      product.get('taxPercentage')?.setValue(percentages);
    }
  }

  private calculateSubtotal(productForm: FormGroup): void {
    const amount = productForm.get('amount')?.value || 0;
    const unitPrice = productForm.get('unitPrice')?.value || 0;
    const discount = productForm.get('discount')?.value || 0; // Cambiado de 'descount' a 'discount'

    const subtotalBeforeDiscount = amount * unitPrice;
    const discountAmount = subtotalBeforeDiscount * (discount / 100);
    const subtotal = subtotalBeforeDiscount - discountAmount;

    productForm.get('subtotal')?.setValue(subtotal);

    // Recalcular el total general
    this.calculateTotalValue();
  }

  private calculateTotalValue(): void {
    let total = 0;
    this.factProducts.controls.forEach(product => {
      const subtotal = product.get('subtotal')?.value || 0;
      total += subtotal;
    });

    this.invoiceForm.get('totalValue')?.setValue(total);
    this.calculatePendingValue();
  }

  private calculatePendingValue(): void {
    const totalValue = this.invoiceForm.get('totalValue')?.value || 0;
    const totalPay = this.invoiceForm.get('totalPay')?.value || 0;
    const pendingValue = totalValue - totalPay;

    this.invoiceForm.get('pendingValue')?.setValue(pendingValue);
  }

  onSubmit(): void {
    if (this.invoiceForm.valid) {
      const formValue = this.invoiceForm.getRawValue();

      // Formatear fecha usando los componentes LOCALES. toISOString() convierte a
      // UTC: en una zona horaria adelantada el8 de noviembre a medianoche viaja
      // como7 de noviembre, y entonces el backend lo rechaza porque la fecha de
      // vencimiento no queda posterior a la de emisión.
      const d = formValue.expirationDate;
      const expirationDate =
        d instanceof Date
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          : d;

      // Preparar productos
      const products: Product2[] = formValue.factProducts.map((product: any) => ({
        productId: product.productId,
        amount: product.amount,
        description: product.description,
        discount: product.discount,
        unitPrice: product.unitPrice || 0,
        subtotal: product.subtotal,
        taxPercentage: product.taxPercentage || []
      }));

      const factureData: Facture2 = {
        factCode: formValue.factCode,
        entId: this.entData?.id || '',
        thId: formValue.thId,
        products: products,
        totalValue: formValue.totalValue.toString(),
        totalPay: formValue.totalPay.toString(),
        pendingValue: formValue.pendingValue.toString(),
        expirationDate: expirationDate,
        accountingAccount: formValue.accountingAccount,
        factureType: formValue.invoiceType,
        inventoryConfigType: this.localStorageMethods.getInventoryConfigType()
      };

      console.log('Datos de factura a enviar:', factureData);

      // Llamar al servicio correspondiente según el tipo de factura
      let serviceCall: Observable<void>;

      switch (formValue.invoiceType) {
        case 'PURCHASE':
          serviceCall = this.steletonService.createPurchaseSkeleton(factureData);
          break;
        case 'SALE':
          serviceCall = this.steletonService.createSaleSkeleton(factureData);
          break;
        default:
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Tipo de factura no válido'
          });
          return;
      }

      serviceCall.subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: `Factura creada exitosamente`,
            life: 3000
          });

          // Limpiar el formulario después de guardar exitosamente
          this.clearForm();
        },
          error: (error: any) => {
            console.error('Error al crear factura', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: this.saleSaveErrorDetail(error),
            });
          }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

    /**
     * Devuelve el mensaje exacto que devolvió la API (p. ej. "Insufficient stock.
     * Requested: 9,999, Available: 7."); solo se usa un texto genérico si la
     * respuesta no trae mensaje.
     */
    private saleSaveErrorDetail(error: unknown): string {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        if (apiMessage?.trim()) {
            return apiMessage.trim();
        }
        return 'No se pudo crear la factura';
    }

    /**
     * Marca todos los campos del formulario como touched para mostrar errores.
     */
    private markFormGroupTouched(): void {
    Object.keys(this.invoiceForm.controls).forEach(key => {
      const control = this.invoiceForm.get(key);
      control?.markAsTouched();

      if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            Object.keys(arrayControl.controls).forEach(subKey => {
              arrayControl.get(subKey)?.markAsTouched();
            });
          }
        });
      }
    });
  }

  /**
   * Limpia el formulario y resetea las variables relacionadas
   */
  clearForm(): void {
    this.invoiceForm.reset();
    this.selectedProduct = undefined;
    this.filteredProducts = [];
    this.selectedInvoiceType = '';

    // Resetear el formulario con valores por defecto
    this.invoiceForm = this.createInvoiceForm();
  }

  /**
   * Maneja la acción de cancelar
   */
  cancelForm(): void {
    this.clearForm();
  }

  /**
   * Navega de vuelta a la lista
   */
  goBack(): void {
    this.router.navigate(['/commercial/invoice-template']);
  }

  /**
   * Obtiene el mensaje de error para un campo específico
   */
  getFieldError(fieldName: string): string {
    const field = this.invoiceForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `El campo ${fieldName} es requerido`;
      }
      if (field.errors['min']) {
        return `El valor mínimo es ${field.errors['min'].min}`;
      }
      if (field.errors['max']) {
        return `El valor máximo es ${field.errors['max'].max}`;
      }
    }
    return '';
  }

  onProductSelect(event: ProductResponse, index: number) {
    // Verificar si el producto ya está seleccionado en otro índice
    const isDuplicate = this.factProducts.controls.some((control, idx) => {
      return idx !== index && control.get('productId')?.value === event.id;
    });

    if (isDuplicate) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Producto duplicado',
        detail: 'Este producto ya ha sido agregado a la factura',
        life: 3000
      });

      // Limpiar el campo
      const productForm = this.factProducts.at(index);
      productForm.get('productId')?.setValue('');
      productForm.get('description')?.setValue('');
      return;
    }

    const productForm = this.factProducts.at(index);
    productForm.get('productId')?.setValue(event.id);
    productForm.get('description')?.setValue(event.name);
  }

  filterProducts(event: AutoCompleteCompleteEvent, index: number) {
    this.currentProductIndex = index;
    const query = event.query.toLowerCase();

    // Obtener IDs de productos ya seleccionados (excluyendo el actual)
    const selectedProductIds = this.factProducts.controls
      .map((control, idx) => idx !== index ? control.get('productId')?.value : null)
      .filter(id => id !== null && id !== '');

    this.filteredProducts = this.allProducts.filter(product => {
      // Filtrar por búsqueda y excluir productos ya seleccionados
      return product.name.toLowerCase().includes(query) &&
             !selectedProductIds.includes(product.id);
    });
  }
}
