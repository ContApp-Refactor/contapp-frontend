import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { finalize, Subscription, timeout, TimeoutError } from 'rxjs';
import { Third } from '../../../../GeneralMasters/ThirdParties/models/Third';
import { eThirdType } from '../../../../GeneralMasters/ThirdParties/models/eThirdType';
import { ThirdService } from '../../../../GeneralMasters/ThirdParties/Services/third.service';
import { LocalStorageMethods } from '../../../../Shared/Methods/local-storage.method';
import { ProductToSale } from '../../../SaleInvoice/models/ProductToSale';
import { SaleInvoiceSelectedProductsComponent } from '../../../SaleInvoice/components/sale-invoice-selected-products/sale-invoice-selected-products.component';
import { UnitOfMeasureService } from '../../../SaleInvoice/services/unit-of-measure.service';
import { PurchaseInvoicePayload, PurchaseInvoiceProductLine } from '../../models/purchase-invoice-payload';
import { PurchaseInvoiceService } from '../../services/purchase-invoice.service';

@Component({
  selector: 'app-purchase-invoice-creation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    TooltipModule,
    AutoCompleteModule,
    DatePickerModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [DialogService, MessageService, ConfirmationService],
  templateUrl: './purchase-invoice-creation.component.html',
  styleUrl: './purchase-invoice-creation.component.css',
})
export class PurchaseInvoiceCreationComponent implements OnInit, OnDestroy {
  private static readonly SAVE_TIMEOUT_MS = 20_000;
  private static readonly MIN_INITIAL_PAYMENT_COP = 50;

  private readonly localStorageMethods = new LocalStorageMethods();
  private ref?: DynamicDialogRef;
  private dialogSubscription?: Subscription;

  currentDate = new Date();
  dueDate?: Date;
  minDueDate!: Date;
  paymentTermDays = 30;
  initialPayment = 0;
  observations = '';
  saving = false;

  supplier?: Third;
  filteredSuppliers: Third[] = [];
  allSuppliers: Third[] = [];

  lstProducts: ProductToSale[] = [];
  subTotal = 0;
  taxTotal = 0;
  total = 0;
  pendingTotal = 0;
  impuestoCheck = true;

  private syncingPaymentSchedule = false;

  constructor(
    private readonly thirdService: ThirdService,
    private readonly unitMeasureService: UnitOfMeasureService,
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
    private readonly dialogService: DialogService,
    private readonly messageService: MessageService,
    private readonly confirmationService: ConfirmationService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.minDueDate = this.addDays(this.stripTime(this.currentDate), 1);
    this.syncDueDateFromPaymentTerm();
    this.loadSuppliers();
  }

  ngOnDestroy(): void {
    this.ref?.close();
    this.dialogSubscription?.unsubscribe();
  }

  loadSuppliers(): void {
    const entId = this.localStorageMethods.getIdEnterprise();
    this.thirdService.getThirdsByType(entId.toString(), eThirdType.Proveedor).subscribe({
      next: (data) => {
        this.allSuppliers = data.content || [];
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los proveedores',
        });
      },
    });
  }

  searchSupplier(event: { query: string }): void {
    const query = (event.query || '').toLowerCase();
    const suppliersWithLabel = this.allSuppliers.map((third) => ({
      ...third,
      displayName: this.getDisplayName(third),
    }));

    this.filteredSuppliers = !query
      ? suppliersWithLabel.slice(0, 50)
      : suppliersWithLabel.filter((third) => {
          const idNumber = third.idNumber?.toString().toLowerCase() || '';
          return third.displayName.toLowerCase().includes(query) || idNumber.includes(query);
        });
  }

  getDisplayName(third: Third): string {
    if (third.personType === 'Natural') {
      return `${third.names || ''} ${third.lastNames || ''}`.trim();
    }
    return third.socialReason || '';
  }

  onSupplierSelect(): void {
    if (this.lstProducts.length === 0) {
      return;
    }
    this.confirmationService.confirm({
      header: 'Cambio de proveedor',
      message: 'Cambiar de proveedor limpiará los productos seleccionados. ¿Desea continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, continuar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.lstProducts = [];
        this.calculateTotals();
      },
    });
  }

  selectProducts(): void {
    if (!this.supplier?.thId) {
      return;
    }
    const entId = this.localStorageMethods.getIdEnterprise();
    this.ref = this.dialogService.open(SaleInvoiceSelectedProductsComponent, {
      header: 'Seleccionar productos',
      width: '50%',
      contentStyle: { 'max-height': '500px', overflow: 'auto' },
      data: { entId, thId: this.supplier.thId, products: this.lstProducts },
    });

    this.dialogSubscription = this.ref.onClose.subscribe((result: any[]) => {
      if (!result?.length) {
        return;
      }
      this.lstProducts = result.map((prod) => {
        const maxQuantity = this.toAmount(prod.quantity, 0);
        const initialAmount = maxQuantity > 0 ? Math.min(1, maxQuantity) : 0;
        return this.normalizeProductLine({
          id: prod.id,
          name: prod.name,
          description: prod.description,
          cost: prod.cost,
          displayPrice: String(prod.cost ?? 0),
          taxPercentage: prod.taxPercentage,
          unitOfMeasureId: prod.unitOfMeasureId,
          minQuantity: 1,
          maxQuantity,
          IVA: prod.taxPercentage ?? 0,
          IvaValor: 0,
          amount: initialAmount,
          totalValue: 0,
          descuentos: [0, 0] as [number, number],
          displayDescuentos: '0',
        } as ProductToSale);
      });
      this.lstProducts.forEach((prod) => this.calculateLine(prod));
      this.loadUnitOfMeasureAbbreviations();
    });
  }

  calculateTotals(): void {
    this.subTotal = this.sumLineValues((prod) => this.computeLineSubtotal(prod));
    this.taxTotal = this.impuestoCheck
      ? this.sumLineValues((prod) => this.computeLineTax(prod))
      : 0;
    this.total = this.subTotal + this.taxTotal;
    this.enforceInitialPaymentLimit(false);
    this.pendingTotal = Math.max(this.total - this.toAmount(this.initialPayment), 0);
  }

  onInitialPaymentChange(): void {
    this.enforceInitialPaymentLimit(true);
    this.calculateTotals();
  }

  maxInitialPayment(): number {
    return Math.max(this.toAmount(this.total), 0);
  }

  minInitialPayment(): number {
    return this.canRegisterPartialInitialPayment() ? PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP : 0;
  }

  calculateLine(prod: ProductToSale): void {
    this.enforceQuantityLimit(prod, true);
    this.normalizeProductLine(prod);
    prod.totalValue = this.computeLineSubtotal(prod);
    prod.IvaValor = this.computeLineTax(prod);
    this.calculateTotals();
  }

  onQuantityChange(prod: ProductToSale): void {
    this.calculateLine(prod);
  }

  lineSubtotal(prod: ProductToSale): number {
    return this.computeLineSubtotal(prod);
  }

  maxQuantityFor(prod: ProductToSale): number {
    return Math.max(this.toAmount(prod.maxQuantity), 0);
  }

  formatCop(value: number | null | undefined): string {
    const amount = this.toAmount(value);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  switchDescuento(type: 'porc' | 'val', prod: ProductToSale): void {
    if (!prod.descuentos) {
      return;
    }
    if (type === 'porc') {
      prod.descuentos[1] = 0;
    } else {
      prod.descuentos[0] = 0;
    }
    this.calculateLine(prod);
  }

  deleteProduct(index: number): void {
    this.lstProducts.splice(index, 1);
    this.calculateTotals();
  }

  saveInvoice(): void {
    if (!this.supplier?.thId) {
      this.messageService.add({ severity: 'warn', summary: 'Proveedor requerido', detail: 'Seleccione un proveedor' });
      return;
    }
    if (this.lstProducts.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Productos requeridos', detail: 'Agregue al menos un producto' });
      return;
    }
    const invalidQuantity = this.lstProducts.find((prod) => {
      const max = this.maxQuantityFor(prod);
      const amount = this.toAmount(prod.amount);
      return max <= 0 || amount <= 0 || amount > max;
    });
    if (invalidQuantity) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cantidad inválida',
        detail: `El producto "${invalidQuantity.name}" no puede superar el inventario disponible (${this.maxQuantityFor(invalidQuantity)}).`,
      });
      return;
    }
    const paymentError = this.validateInitialPayment();
    if (paymentError) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Abono inválido',
        detail: paymentError,
      });
      return;
    }
    const dueDateError = this.validateDueDate();
    if (dueDateError) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vencimiento inválido',
        detail: dueDateError,
      });
      return;
    }

    const entData = this.localStorageMethods.loadEnterpriseData();
    if (!entData?.id) {
      this.messageService.add({ severity: 'error', summary: 'Empresa requerida', detail: 'No hay empresa activa' });
      return;
    }

    const expirationDate = this.resolveDueDate();
    const payload: PurchaseInvoicePayload = {
      factCode: 0,
      entId: entData.id,
      thId: this.supplier.thId,
      products: this.buildProductLines(),
      totalValue: this.total.toFixed(2),
      totalPay: (this.initialPayment || 0).toFixed(2),
      pendingValue: this.pendingTotal.toFixed(2),
      issueDate: this.resolveIssueDate(),
      expirationDate,
      factureType: 'PURCHASE',
      inventoryConfigType: this.localStorageMethods.getInventoryConfigType() as 'PEPS' | 'WEIGHTED_AVERAGE',
    };

    this.saving = true;
    this.purchaseInvoiceService.createPurchaseInvoice(payload).pipe(
      timeout(PurchaseInvoiceCreationComponent.SAVE_TIMEOUT_MS),
      finalize(() => {
        this.saving = false;
      }),
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Factura creada',
          detail: 'La factura de compra se registró y se sincronizará con Tesorería',
          life: 5000,
        });
        this.resetForm();
      },
      error: (error) => {
        const timedOut = error instanceof TimeoutError;
        this.messageService.add({
          severity: timedOut ? 'warn' : 'error',
          summary: timedOut ? 'Respuesta demorada' : 'Error',
          detail: timedOut
            ? 'El servidor tardó demasiado en responder. Verifique el listado antes de intentar guardar nuevamente.'
            : this.purchaseSaveErrorDetail(error),
        });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/enterprise/list']);
  }

  private purchaseSaveErrorDetail(error: unknown): string {
    const apiMessage = (error as { error?: { message?: string } })?.error?.message;
    if (apiMessage?.trim()) {
      return apiMessage.trim();
    }
    return 'No se pudo crear la factura de compra';
  }

  onPaymentTermChange(): void {
    if (this.syncingPaymentSchedule) {
      return;
    }
    this.syncingPaymentSchedule = true;
    this.paymentTermDays = Math.max(this.toAmount(this.paymentTermDays, 1), 1);
    this.dueDate = this.addDays(this.stripTime(this.currentDate), this.paymentTermDays);
    this.releasePaymentScheduleSync();
  }

  onIssueDateChange(selectedDate: Date | null): void {
    if (!selectedDate) {
      return;
    }
    this.currentDate = selectedDate;
    this.minDueDate = this.addDays(this.stripTime(this.currentDate), 1);
    this.syncDueDateFromPaymentTerm();
  }

  onDueDateChange(selectedDate: Date | null): void {
    if (this.syncingPaymentSchedule || !selectedDate) {
      return;
    }
    this.syncingPaymentSchedule = true;
    const previousDay = this.dueDate ? this.stripTime(this.dueDate).getTime() : null;
    this.dueDate = selectedDate;
    this.enforceDueDateLimit(previousDay !== this.stripTime(this.dueDate).getTime());
    this.paymentTermDays = this.daysBetweenEmissionAndDue(this.dueDate);
    this.releasePaymentScheduleSync();
  }

  private syncDueDateFromPaymentTerm(): void {
    this.paymentTermDays = Math.max(this.toAmount(this.paymentTermDays, 30), 1);
    this.dueDate = this.addDays(this.stripTime(this.currentDate), this.paymentTermDays);
  }

  private daysBetweenEmissionAndDue(due: Date): number {
    const emission = this.stripTime(this.currentDate);
    const dueDay = this.stripTime(due);
    const diffMs = dueDay.getTime() - emission.getTime();
    return Math.max(Math.round(diffMs / (1000 * 60 * 60 * 24)), 1);
  }

  private releasePaymentScheduleSync(): void {
    setTimeout(() => {
      this.syncingPaymentSchedule = false;
    });
  }

  private buildProductLines(): PurchaseInvoiceProductLine[] {
    return this.lstProducts.map((prod) => ({
      productId: prod.id,
      amount: prod.amount,
      description: prod.description,
      discount: this.discountPercent(prod),
      unitPrice: prod.cost,
      subtotal: this.computeLineSubtotal(prod),
      taxPercentage: this.impuestoCheck && prod.IVA ? [prod.IVA] : [],
    }));
  }

  private discountPercent(prod: ProductToSale): number {
    if (!prod.descuentos) {
      return 0;
    }
    if (prod.descuentos[1] > 0) {
      const base = prod.cost * prod.amount;
      return base > 0 ? (100 * prod.descuentos[1]) / base : 0;
    }
    return prod.descuentos[0] || 0;
  }

  private computeLineSubtotal(prod: ProductToSale): number {
    const unitCost = this.toAmount(prod.cost);
    const quantity = this.toAmount(prod.amount, 1);
    const base = unitCost * quantity;
    const discountPerc = this.toAmount(prod.descuentos?.[0]);
    const discountVal = this.toAmount(prod.descuentos?.[1]);
    return Math.max(base - base * (discountPerc / 100) - discountVal, 0);
  }

  private computeLineTax(prod: ProductToSale): number {
    if (!this.impuestoCheck) {
      return 0;
    }
    const lineSubtotal = this.computeLineSubtotal(prod);
    const taxRate = this.toAmount(prod.IVA);
    return lineSubtotal * (taxRate / 100);
  }

  private normalizeProductLine(prod: ProductToSale): ProductToSale {
    prod.maxQuantity = this.toAmount(prod.maxQuantity, 0);
    prod.minQuantity = Math.max(this.toAmount(prod.minQuantity, 1), 1);
    prod.amount = this.toAmount(prod.amount, prod.maxQuantity > 0 ? 1 : 0);
    this.enforceQuantityLimit(prod, false);
    prod.cost = this.toAmount(prod.cost);
    prod.IVA = this.toAmount(prod.IVA ?? prod.taxPercentage);
    if (!prod.descuentos || prod.descuentos.length < 2) {
      prod.descuentos = [0, 0];
    }
    prod.descuentos[0] = this.toAmount(prod.descuentos[0]);
    prod.descuentos[1] = this.toAmount(prod.descuentos[1]);
    return prod;
  }

  private enforceQuantityLimit(prod: ProductToSale, notify: boolean): void {
    const max = this.maxQuantityFor(prod);
    const current = this.toAmount(prod.amount);
    if (max <= 0 && current > 0) {
      prod.amount = 0;
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin inventario',
          detail: `El producto "${prod.name}" no tiene existencias disponibles.`,
        });
      }
      return;
    }
    if (current > max) {
      prod.amount = max;
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Cantidad inválida',
          detail: `La cantidad de "${prod.name}" no puede superar el inventario disponible (${max}).`,
        });
      }
    }
  }

  private canRegisterPartialInitialPayment(): boolean {
    return this.toAmount(this.total) >= PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP;
  }

  private validateDueDate(): string | null {
    const due = this.dueDate ?? this.addDays(this.currentDate, Math.max(this.paymentTermDays, 1));
    if (this.stripTime(due).getTime() < this.minDueDate.getTime()) {
      return 'La fecha de vencimiento debe ser posterior a la fecha de emisión.';
    }
    return null;
  }

  private enforceDueDateLimit(notify: boolean): void {
    if (!this.dueDate) {
      return;
    }
    const min = this.minDueDate;
    if (this.stripTime(this.dueDate).getTime() < min.getTime()) {
      this.dueDate = new Date(min);
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Vencimiento inválido',
          detail: 'La fecha de vencimiento debe ser posterior a la fecha de emisión.',
        });
      }
    }
  }

  private validateInitialPayment(): string | null {
    const total = this.toAmount(this.total);
    const payment = this.toAmount(this.initialPayment);

    if (payment <= 0) {
      return null;
    }

    if (payment > total) {
      return `El abono no puede superar el total de la factura (${this.formatCop(total)}).`;
    }

    if (!this.canRegisterPartialInitialPayment()) {
      return `El total es menor a ${this.formatCop(PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP)}; deje el abono en 0 y pague en Tesorería si corresponde.`;
    }

    if (payment < PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP) {
      return `El abono mínimo es ${this.formatCop(PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP)}.`;
    }

    if (payment >= total) {
      return 'Si pagó el total de la factura, deje el abono en 0 y registre el pago en Tesorería (Comprobante de egreso). El abono inicial es solo para pagos parciales.';
    }

    return null;
  }

  private enforceInitialPaymentLimit(notify: boolean): void {
    const total = this.toAmount(this.total);
    let payment = this.toAmount(this.initialPayment);

    if (payment <= 0) {
      this.initialPayment = 0;
      return;
    }

    if (!this.canRegisterPartialInitialPayment()) {
      this.initialPayment = 0;
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Abono no permitido',
          detail: `El total es menor a ${this.formatCop(PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP)}. Deje el abono en 0.`,
        });
      }
      return;
    }

    const maxPartial = total - 1;
    if (maxPartial < PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP) {
      this.initialPayment = 0;
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Abono no permitido',
          detail: 'No hay un abono parcial válido para este total. Deje el abono en 0.',
        });
      }
      return;
    }

    if (payment > total) {
      payment = total;
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Abono inválido',
          detail: `El abono no puede superar el total (${this.formatCop(total)}).`,
        });
      }
    }

    if (payment >= total) {
      payment = maxPartial;
      if (notify) {
        this.messageService.add({
          severity: 'info',
          summary: 'Pago total en Tesorería',
          detail: 'El abono inicial es parcial. Para pagar el total, deje el abono en 0 y use Comprobante de egreso en Tesorería.',
          life: 6000,
        });
      }
    }

    if (payment < PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP) {
      payment = PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP;
      if (notify) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Abono mínimo',
          detail: `El abono mínimo es ${this.formatCop(PurchaseInvoiceCreationComponent.MIN_INITIAL_PAYMENT_COP)}.`,
        });
      }
    }

    if (payment > maxPartial) {
      payment = maxPartial;
    }

    this.initialPayment = payment;
  }

  private toAmount(value: unknown, fallback = 0): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  private sumLineValues(selector: (prod: ProductToSale) => number): number {
    return this.lstProducts.reduce((acc, prod) => acc + this.toAmount(selector(prod)), 0);
  }

  private resolveDueDate(): string | undefined {
    const due = this.dueDate ?? this.addDays(this.currentDate, Math.max(this.paymentTermDays, 1));
    return this.stripTime(due).toISOString().split('T')[0];
  }

  private resolveIssueDate(): string {
    return this.formatLocalDate(this.currentDate);
  }

  private formatLocalDate(date: Date): string {
    const normalized = this.stripTime(date);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const day = String(normalized.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  private stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private loadUnitOfMeasureAbbreviations(): void {
    const enterpriseId = this.localStorageMethods.getIdEnterprise();
    this.lstProducts.forEach((prod) => {
      if (!prod.unitOfMeasureId) {
        return;
      }
      this.unitMeasureService.getUnitOfMeasuresId(String(prod.unitOfMeasureId), enterpriseId).subscribe({
        next: (response: { abbreviation: string }) => {
          prod.unitOfMeasure = response.abbreviation;
        },
      });
    });
  }

  private resetForm(): void {
    this.supplier = undefined;
    this.lstProducts = [];
    this.initialPayment = 0;
    this.observations = '';
    this.currentDate = new Date();
    this.paymentTermDays = 30;
    this.minDueDate = this.addDays(this.stripTime(this.currentDate), 1);
    this.syncDueDateFromPaymentTerm();
    this.calculateTotals();
  }
}
