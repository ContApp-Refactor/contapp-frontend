import { DatePipe, Location, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumber, InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Subject, debounceTime, finalize, firstValueFrom } from 'rxjs';
import {
  BillingClient,
  BillingIssuer,
  BillingPayment,
  BillingPaymentMethod,
  BillingProduct,
  BillingWithholding,
  INVOICE_STATUS_LABEL,
  InvoiceStatus,
  InvoiceTotals,
  SaleInvoice,
  SaleInvoiceLine,
  WithholdingInput,
} from '../../models/billing-sale-invoice.model';
import { ReturnAvailabilityLine, SaleReturn } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingPaymentCatalog } from '../../services/billing-payment-catalog';
import { BillingTax, BillingTaxCatalog } from '../../services/billing-tax-catalog';
import { BillingProductCatalog } from '../../services/billing-product-catalog';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { SaleReturnPreviewComponent } from '../sale-return-preview/sale-return-preview.component';
import { RETURNED_INVOICE_LABEL, deriveReturnState, returnOrdinals, returnTotals } from '../../utils/sale-return';
import { billingErrorMessage, isConcurrentModification, isDuplicateSupplierInvoice } from '../../utils/billing-error';
import { isoDateText } from '../../utils/format';
import { NO_PAYMENT_METHODS_MESSAGE } from '../../utils/payment';
import { NothingToReturnError, fullReturnErrorMessage, returnWholeInvoice } from '../../utils/full-return';
import { buildReturnQuery } from '../../utils/return-trail';
import {
  MIN_QUANTITY,
  calcTotals,
  centsToPesos,
  isWholeQty,
  lineSubtotalOf,
  pesosToCents,
  taxSummaryRows,
  WithholdingRow,
  withholdingAmountCents,
  withholdingLabel,
  withholdingRowsOf,
  withTotalsNet,
  wholeQty,
} from '../../utils/money';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';
import { BillingTaxBreakdownComponent } from '../billing-tax-breakdown/billing-tax-breakdown.component';
import { BillingTaxSummaryComponent } from '../billing-tax-summary/billing-tax-summary.component';
import { hasTaxBreakdown, sameTaxes } from '../../utils/tax-breakdown';
import { SaleInvoicePreviewComponent } from '../sale-invoice-preview/sale-invoice-preview.component';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Fila de la tabla de devoluciones de la factura (campos planos para los filtros de columna)
interface ReturnRow {
  ret: SaleReturn;
  ordinal: number | null;
  numberText: string;
  dateText: string;
  reasonText: string;
  totalPesos: number;
  totalCents: number;
  statusLabel: string;
}

const AUTOSAVE_DEBOUNCE_MS = 800;
// Cantidad mínima de una línea: MIN_QUANTITY (1). Inventario solo admite cantidades ENTERAS y el back exige cantidad > 0
// también en borrador (si no, el autosave falla).

const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Formulario de factura de venta Y de compra. El tipo llega por `data.kind` de la ruta
// (sale/* o purchase/*) y, al cargar una factura existente, prevalece el de la factura.
// clientId/clientName = contraparte: cliente en ventas, proveedor en compras.
@Component({
  selector: 'app-sale-invoice-form',
  imports: [
    FormsModule,
    ButtonModule,
    CheckboxModule,
    ConfirmDialogModule,
    DatePipe,
    NgTemplateOutlet,
    SharedModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    CopCentsPipe,
    BillingStatusBadgeComponent,
    BillingTaxBreakdownComponent,
    BillingTaxSummaryComponent,
    SaleInvoicePreviewComponent,
    SaleReturnPreviewComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './sale-invoice-form.component.html',
})
export class SaleInvoiceFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(BillingSaleInvoiceApi);
  private readonly catalog = inject(BillingProductCatalog);
  private readonly counterpartyCatalog = inject(BillingCounterpartyCatalog);
  private readonly paymentCatalog = inject(BillingPaymentCatalog);
  private readonly taxCatalog = inject(BillingTaxCatalog);
  private readonly returnApi = inject(BillingSaleReturnApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  // Catálogos
  products = signal<BillingProduct[]>([]);
  clients = signal<BillingClient[]>([]);

  // Estado de la factura
  kind = signal<DocumentKind>('SALE');
  cfg = computed(() => DOCUMENT_KIND_CONFIG[this.kind()]);
  invoiceId = signal<string | null>(null);
  openedAsNew = signal(true); // false al abrir un borrador/factura existente: define el título ("Nueva..." vs "Borrador de...")
  number = signal<string | null>(null);
  status = signal<InvoiceStatus>('BORRADOR');
  clientId = signal<string | null>(null);
  supplierInvoiceNumber = signal<string>(''); // solo compras
  date = signal<string>(todayIso());
  lines = signal<SaleInvoiceLine[]>([]);
  annulReason = signal<string | null>(null);

  // Pago (facturas de venta y compra): método y, si lo exige, cuenta
  // El método de pago aplica a ambas facturas (venta y compra); este form no sirve devoluciones.
  hasPayment = computed(() => this.kind() === 'SALE' || this.kind() === 'PURCHASE');
  readonly noPaymentMethodsMessage = NO_PAYMENT_METHODS_MESSAGE;

  // Retenciones: casillas marcadas + impuesto elegido por cada una. Solo las marcadas CON impuesto se guardan, restan del
  // total y viajan al back; una marcada sin impuesto no cuenta y bloquea "Emitir".
  withholdings = signal<string[]>([]);
  toggleWithholding(code: string, checked: boolean): void {
    const before = this.withholdingsKey();
    this.withholdings.update((cur) => {
      const rest = cur.filter((c) => c !== code);
      return checked ? [...rest, code] : rest;
    });
    // Al desmarcar se limpia el impuesto elegido; al marcar arranca sin selección
    this.withholdingTaxes.update((cur) => ({ ...cur, [code]: null }));
    this.markDirtyIfWithholdingsChanged(before);
  }
  withholdingTaxes = signal<Record<string, string | null>>({}); // código de retención -> id de impuesto
  taxes = signal<BillingTax[]>([]);
  taxesState = signal<'loading' | 'ready' | 'failed'>('loading');
  readonly noTaxesMessage = 'No hay impuestos creados en la empresa';
  // Impuestos de retenciones restauradas del borrador (por si ya no están en el catálogo): así el select no queda vacío
  private restoredTaxes = signal<Record<string, { id: string; name: string; rate: number }>>({});
  taxOptions = computed(() => {
    const label = (name: string, rate: number | null | undefined) => (rate != null ? `${name} - ${rate}%` : name);
    const options = this.taxes().map((t) => ({ id: t.id, label: label(t.name, t.rate) }));
    if (this.taxesState() === 'loading') return options;
    for (const r of Object.values(this.restoredTaxes())) {
      if (!options.some((o) => o.id === r.id)) options.push({ id: r.id, label: label(r.name, r.rate) });
    }
    return options;
  });
  onWithholdingTaxChange(code: string, taxId: string | null): void {
    const before = this.withholdingsKey();
    this.withholdingTaxes.update((cur) => ({ ...cur, [code]: taxId }));
    this.markDirtyIfWithholdingsChanged(before);
  }
  // Lo que se envía al guardar: solo las casillas marcadas que ya tienen impuesto
  withholdingPayload = computed<WithholdingInput[]>(() =>
    this.cfg()
      .withholdings.filter((w) => this.withholdings().includes(w.code) && !!this.withholdingTaxes()[w.code])
      .map((w) => ({ code: w.code, taxId: this.withholdingTaxes()[w.code]! })),
  );
  // Casillas marcadas que aún no tienen impuesto (bloquean la emisión)
  withholdingsMissingTax = computed(() =>
    this.cfg().withholdings.filter((w) => this.withholdings().includes(w.code) && !this.withholdingTaxes()[w.code]),
  );
  private withholdingsKey(): string {
    return JSON.stringify(this.withholdingPayload());
  }
  // Marcar/desmarcar o cambiar el impuesto es un cambio del borrador como cualquier otro, pero solo si cambia lo que se guarda
  private markDirtyIfWithholdingsChanged(before: string): void {
    if (this.withholdingsKey() !== before) this.markDirty();
  }
  // Respuesta del back (retenciones y subtotal con que se calcularon): fuente de verdad mientras el subtotal local coincida
  private serverWithholdings = signal<BillingWithholding[]>([]);
  private serverSubtotal = signal<number | null>(null);
  // Filas a mostrar. No editable: el snapshot congelado del back. Borrador: cálculo local en vivo
  // round(subtotal × tasa / 100) para verlas antes de guardar; cuando el back respondió con el mismo subtotal y la misma
  // selección, sus valores mandan.
  withholdingRows = computed<WithholdingRow[]>(() => {
    if (!this.editable()) return withholdingRowsOf(this.serverWithholdings());
    const subtotal = calcTotals(this.lines()).subtotalCents;
    const fromServer = this.serverSubtotal() === subtotal ? this.serverWithholdings() : [];
    return this.withholdingPayload().map((p) => {
      const taxId = String(p.taxId);
      const srv = fromServer.find((s) => s.code === p.code && String(s.taxId) === taxId);
      if (srv) return withholdingRowsOf([srv])[0];
      const tax = this.taxes().find((t) => t.id === taxId);
      const restored = this.restoredTaxes()[p.code];
      const ratePct = tax?.rate ?? (restored?.id === taxId ? restored.rate : 0);
      return {
        code: p.code,
        label: withholdingLabel(p.code),
        taxName: tax?.name ?? (restored?.id === taxId ? restored.name : ''),
        ratePct,
        amountCents: withholdingAmountCents(subtotal, ratePct),
      };
    });
  });
  // Impuestos de la empresa: se cargan una sola vez (no por casilla)
  loadTaxes(): void {
    this.taxesState.set('loading');
    this.taxCatalog
      .getTaxes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.taxes.set(list);
          this.taxesState.set('ready');
        },
        error: () => this.taxesState.set('failed'),
      });
  }
  paymentMethodId = signal<string | null>(null);
  paymentMethodName = signal<string | null>(null); // congelado por el back al emitir
  paymentMethods = signal<BillingPaymentMethod[]>([]);
  paymentMethodsState = signal<'loading' | 'ready' | 'failed'>('loading');
  selectedPaymentMethod = computed(() => this.paymentMethods().find((m) => m.id === this.paymentMethodId()) ?? null);
  // Nombre del método: el congelado al emitir; en borrador, el del catálogo vivo
  paymentMethodLabel = computed(
    () =>
      this.paymentMethodName() ??
      this.selectedPaymentMethod()?.name ??
      (this.paymentMethodId() ? `N.º ${this.paymentMethodId()}` : '—'),
  );
  // Pago actual del formulario: lo que se guarda y lo que ve la vista previa/PDF
  payment = computed<BillingPayment | null>(() => {
    if (!this.hasPayment() || !this.paymentMethodId()) return null;
    return { methodId: this.paymentMethodId(), methodName: this.paymentMethodLabel() };
  });

  // UI
  loading = signal(true);
  busy = signal(false);
  saveState = signal<SaveState>('idle');
  supplierNumberError = signal<string | null>(null); // N.º de factura del proveedor repetido (se muestra bajo el campo)
  previewVisible = signal(false);
  selectedProductId: string | null = null;

  // Solo el borrador es editable; EMITIDA/ANULADA son de solo lectura total
  editable = computed(() => this.status() === 'BORRADOR');
  // Totales que calculó el back (solo se usan en documentos no editables; en borrador se calcula localmente)
  serverTotals = signal<InvoiceTotals | null>(null);
  // Borrador: subtotal + impuestos − retenciones (local); emitida/anulada: los del back (totalCents ya neto)
  totals = computed(() =>
    this.editable()
      ? withTotalsNet(calcTotals(this.lines()), this.withholdingRows())
      : (this.serverTotals() ?? withTotalsNet(calcTotals(this.lines()), this.withholdingRows())),
  );
  taxRows = computed(() => taxSummaryRows(this.lines(), this.editable()));
  /** Opciones del selector: "NIT - Nombre" (solo el nombre si el tercero no tiene documento). */
  clientOptions = computed(() =>
    this.clients().map((c) => {
      const doc = (c.document ?? '').toString().trim();
      return { ...c, label: doc ? `${doc} - ${c.name}` : c.name };
    }),
  );
  selectedClient = computed(() => this.clients().find((c) => c.id === this.clientId()) ?? null);
  // Datos congelados por el back en documentos emitidos/anulados (RN-06): el tercero y el emisor no cambian aunque
  // cambie el catálogo. En borrador el tercero sigue siendo el del catálogo vivo.
  frozenClientName = signal<string | null>(null);
  frozenClientDocument = signal<string | null>(null);
  issuer = signal<BillingIssuer | null>(null);
  verificationCode = signal<string | null>(null); // código de verificación del back (QR de la vista previa)
  clientName = computed(() =>
    this.editable()
      ? (this.selectedClient()?.name ?? '—')
      : (this.frozenClientName() ?? this.selectedClient()?.name ?? '—'),
  );
  // Documento del tercero: solo el congelado en documentos no editables (sin dato no se muestra el vivo)
  clientDocument = computed(() => (this.editable() ? null : this.frozenClientDocument()));
  // Tercero que recibe la vista previa: en no editables, con los valores congelados de la respuesta
  // Contacto de la contraparte que devuelve el back en la factura (en borrador, refrescado en vivo en el GET)
  clientContact = signal<Pick<BillingClient, 'address' | 'city' | 'phone' | 'email'>>({});
  previewClient = computed<BillingClient | null>(() => {
    const live = this.selectedClient();
    const contact = this.clientContact();
    if (this.editable()) return live ? { ...live, ...contact } : null;
    const name = this.frozenClientName();
    if (name === null) return live ? { ...live, ...contact } : null;
    return { id: this.clientId() ?? '', name, document: this.frozenClientDocument() ?? '—', category: live?.category, ...contact };
  });

  // Devoluciones de esta factura (solo se cargan cuando ya no es borrador)
  returns = signal<SaleReturn[]>([]);
  availability = signal<ReturnAvailabilityLine[]>([]);
  // Solo se listan las devoluciones emitidas/anuladas: los borradores de devolución no se muestran
  // (la devolución en curso se retoma desde el botón "Devolución")
  visibleReturns = computed(() => this.returns().filter((r) => r.status !== 'BORRADOR'));
  // Filas con campos planos para los filtros de columna (p-columnFilter)
  returnRows = computed<ReturnRow[]>(() =>
    this.visibleReturns().map((ret) => {
      const ordinal = this.returnOrdinalMap().get(ret.id) ?? null;
      const totalCents = returnTotals(ret).totalCents;
      return {
        ret,
        ordinal,
        numberText: `${ordinal ? `Devolución ${ordinal}` : ''} ${ret.number ?? ''}`.trim(),
        dateText: isoDateText(ret.date),
        reasonText: ret.reason ?? '',
        totalPesos: centsToPesos(totalCents),
        totalCents,
        statusLabel: INVOICE_STATUS_LABEL[ret.status],
      };
    }),
  );
  // El botón "Devolución" solo aparece en una EMITIDA con algo aún devolvible
  // (al menos una unidad ENTERA: en una factura histórica con decimales una fracción < 1 ya no se puede devolver)
  canReturn = computed(() => this.status() === 'EMITIDA' && this.availability().some((a) => wholeQty(a.available) >= MIN_QUANTITY));
  returnOrdinalMap = computed(() => returnOrdinals(this.returns()));
  previewReturn = signal<SaleReturn | null>(null);
  returnState = computed(() => deriveReturnState(this.lines(), this.returns()));
  // Misma etiqueta que el listado y "Facturas con devolución": "Devuelta" / "Devuelta parcialmente"
  returnedLabel = computed(() => RETURNED_INVOICE_LABEL[this.returnState()] ?? '');

  // Diálogo "Devolver factura completa" (reemplaza a la antigua anulación: anular = devolver todo)
  fullReturnVisible = signal(false);
  fullReturnReason = '';
  fullReturning = signal(false);
  returnsLoaded = signal(false); // evita mostrar "sin devoluciones" mientras aún se cargan
  returnsLoadFailed = signal(false); // no se pudo listar: no se debe afirmar "sin devoluciones"
  availabilityFailed = signal(false); // no se pudo consultar la disponibilidad: se avisa en vez de ocultar botones sin explicación

  // Para habilitar luego la edición de más campos de la línea, basta agregar aquí el campo
  // y su input en la plantilla (hoy solo el precio unitario es editable).
  readonly editableLineFields = ['precioUnitario'] as const;

  private dirty = false;
  private version: number | null = null; // versión del borrador según la última respuesta del back (bloqueo optimista)
  private destroyed = false;
  private autosaveFailing = false; // racha de fallos del autosave: se avisa una sola vez
  private refreshing = false;
  private writes = 0; // contador de escrituras (guardar/emitir/eliminar): descarta refrescos GET anteriores a ellas
  private readonly autosave$ = new Subject<void>();
  // Cadena de guardados: serializa las escrituras para no crear borradores duplicados
  private saveChain: Promise<unknown> = Promise.resolve();

  ngOnInit(): void {
    this.kind.set(this.route.snapshot.data['kind'] ?? 'SALE');
    this.loadProducts();
    this.loadCounterparties();
    this.loadPaymentMethods();
    this.loadTaxes();

    this.autosave$
      .pipe(debounceTime(AUTOSAVE_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persist().catch((e) => this.onAutosaveError(e)));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.openedAsNew.set(false);
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invoice) => {
          // La factura manda: si la ruta no coincide con su tipo, se recargan los catálogos del tipo real
          if (invoice.kind !== this.kind()) {
            this.kind.set(invoice.kind);
            this.loadProducts();
            this.loadCounterparties();
            this.loadPaymentMethods();
          }
          this.applyInvoice(invoice);
          this.loading.set(false);
          if (invoice.status !== 'BORRADOR') this.loadReturns(invoice.id, invoice.status);
        },
        error: () => {
          this.toast('error', 'Factura no encontrada', 'No existe la factura solicitada.');
          this.router.navigate([this.cfg().basePath]);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true; // el guardado pendiente no debe tocar la URL (location.replaceState) de otra pantalla
    // Al salir de la pantalla se persiste lo pendiente (el mock escribe de forma síncrona)
    if (this.dirty && this.editable()) {
      this.persist().catch((e) => this.toast('error', 'No se pudo guardar el borrador al salir', this.errorMessage(e)));
    }
  }

  // Fallo del autosave: queda el estado "error" y se avisa UNA vez por racha de fallos (no en cada intento)
  private onAutosaveError(e: unknown): void {
    this.saveState.set('error');
    this.noteDuplicateSupplierNumber(e);
    if (isConcurrentModification(e)) {
      this.fail('No se pudo guardar', e);
      return;
    }
    if (this.autosaveFailing) return;
    this.autosaveFailing = true;
    this.toast('error', 'No se pudo guardar automáticamente', `${this.errorMessage(e)} Tus cambios siguen en pantalla; se reintentará al editar.`);
  }

  // --- devoluciones ---

  private loadReturns(invoiceId: string, status: InvoiceStatus): void {
    this.returnsLoadFailed.set(false);
    this.returnApi
      .listByInvoice(invoiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.returns.set(list);
          this.returnsLoaded.set(true);
        },
        error: (e) => {
          this.returnsLoaded.set(true);
          this.returnsLoadFailed.set(true);
          this.toast('error', 'No se pudieron cargar las devoluciones', this.errorMessage(e));
        },
      });
    if (status !== 'EMITIDA') return; // solo una factura emitida se puede devolver
    this.availabilityFailed.set(false);
    this.returnApi
      .getAvailability(invoiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (a) => this.availability.set(a),
        error: (e) => {
          this.availabilityFailed.set(true);
          this.toast('warn', 'No se pudo verificar la disponibilidad', this.errorMessage(e));
        },
      });
  }

  /** Reintento manual (aviso discreto) tras fallar la carga de devoluciones o de la disponibilidad. */
  retryReturns(): void {
    const id = this.invoiceId();
    if (id) this.loadReturns(id, this.status());
  }

  newReturn(): void {
    // Si ya quedó una devolución a medias (borrador) se retoma en vez de crear otra
    const draft = this.returns().find((r) => r.status === 'BORRADOR');
    if (draft) {
      this.openReturn(draft);
      return;
    }
    this.router.navigate([this.cfg().basePath, this.invoiceId(), 'return', 'new']);
  }

  openReturn(saleReturn: SaleReturn): void {
    this.router.navigate(['/billing/return', saleReturn.id]);
  }

  // --- devolver factura completa (anular = devolver todo lo disponible) ---

  openFullReturn(): void {
    if (this.busy()) return;
    this.fullReturnReason = '';
    this.fullReturnVisible.set(true);
  }

  closeFullReturn(): void {
    this.fullReturnVisible.set(false);
  }

  async confirmFullReturn(): Promise<void> {
    if (this.fullReturning()) return; // reentrada: N clics => una sola devolución
    const id = this.invoiceId();
    if (!id) return;
    if (!this.fullReturnReason.trim()) {
      this.toast('warn', 'Motivo requerido', 'Indica el motivo de la devolución.');
      return;
    }
    this.fullReturning.set(true);
    try {
      const emitted = await returnWholeInvoice(this.returnApi, id, this.fullReturnReason);
      this.closeFullReturn();
      this.toast('success', 'Factura devuelta', `Se emitió la devolución ${emitted.number} por toda la factura.`);
      this.loadReturns(id, this.status()); // actualiza la tabla y la disponibilidad
    } catch (e) {
      if (e instanceof NothingToReturnError) {
        this.closeFullReturn();
        this.availability.update((a) => a.map((l) => ({ ...l, available: 0 })));
        this.toast('warn', 'Sin cantidades disponibles', e.message);
        this.loadReturns(id, this.status()); // la tabla y la disponibilidad reflejan lo que ya devolvió otro
        return;
      }
      // Si Inventario rechazó la emisión no quedó ninguna devolución emitida (el borrador de esta operación se descarta):
      // el diálogo sigue abierto para reintentar
      this.toast('error', 'No se pudo devolver', fullReturnErrorMessage(e));
      // El servidor pudo confirmar la devolución aunque la respuesta falló (p. ej. timeout): se recarga el estado real
      this.loadReturns(id, this.status());
    } finally {
      this.fullReturning.set(false);
    }
  }

  ordinalOf(saleReturn: SaleReturn): number | null {
    return this.returnOrdinalMap().get(saleReturn.id) ?? null;
  }

  openReturnPreview(saleReturn: SaleReturn): void {
    this.previewReturn.set(saleReturn);
  }

  // --- catálogo de productos ---

  private loadProducts(): void {
    this.catalog
      .getProducts(this.kind())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        this.products.set(p);
        if (this.selectedProductId && !p.some((x) => x.id === this.selectedProductId)) {
          this.selectedProductId = null;
        }
      });
  }

  private loadCounterparties(): void {
    this.counterpartyCatalog
      .getCounterparties(this.kind())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((c) => this.clients.set(c));
  }

  // Métodos de pago activos de la empresa (venta y compra). Un fallo NO es lo mismo que "no hay métodos": se avisa distinto
  loadPaymentMethods(): void {
    if (!this.hasPayment()) return;
    this.paymentMethodsState.set('loading');
    this.paymentCatalog
      .getPaymentMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (methods) => {
          this.paymentMethods.set(methods);
          this.paymentMethodsState.set('ready');
        },
        error: () => this.paymentMethodsState.set('failed'),
      });
  }

  /** Atajo a Métodos de Pago: asegura el borrador guardado y abre el maestro (al volver a la pestaña se recarga la lista). */
  async goToPaymentMethods(): Promise<void> {
    if (!this.editable() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.persist();
      const returnTo = `${this.cfg().basePath}/${this.invoiceId() ?? 'new'}`;
      await this.router.navigate(['/gen-masters/payment-methods/list'], {
        queryParams: buildReturnQuery(returnTo),
      });
    } catch (e) {
      this.fail('No se pudo guardar el borrador', e);
    } finally {
      this.busy.set(false);
    }
  }

  // Al volver de crear/editar productos (pestaña o ventana recupera el foco) se recarga
  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  onReturnToWindow(): void {
    if (document.visibilityState !== 'visible' || !this.editable()) return;
    this.loadProducts();
    this.loadPaymentMethods(); // por si se crearon métodos de pago en otra pestaña
    this.refreshDraft();
  }

  // Sin ediciones ni guardados en curso, las líneas del back mandan: el back refresca el catálogo al leer el borrador
  // (precio de referencia y líneas sin override, `precioEditado`), así no se muestra un precio/total viejo tras
  // cambiar costos en Inventario. Con edición pendiente no se pisa nada.
  private refreshDraft(): void {
    const id = this.invoiceId();
    if (!id || this.refreshing || !this.isIdle()) return;
    this.refreshing = true;
    const writesAtStart = this.writes;
    this.api
      .getById(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.refreshing = false)),
      )
      .subscribe({
        next: (invoice) => {
          if (!this.isIdle()) return; // el usuario empezó a editar mientras llegaba la respuesta
          // Una respuesta VIEJA no debe pisar una escritura (guardar/emitir) que terminó mientras el GET estaba en
          // vuelo: la versión retrocedería o una factura emitida volvería a mostrarse como BORRADOR
          if (this.writes !== writesAtStart) return;
          if (invoice.version != null && this.version != null && invoice.version < this.version) return;
          this.applyInvoice(invoice);
          if (invoice.status !== 'BORRADOR') this.loadReturns(invoice.id, invoice.status);
        },
        error: () => undefined, // es un refresco oportunista: si falla se conserva lo que hay en pantalla
      });
  }

  private isIdle(): boolean {
    return !this.dirty && !this.busy() && this.saveState() !== 'pending' && this.saveState() !== 'saving';
  }

  /** Atajo a Productos: asegura el borrador guardado y deja el rastro para volver. */
  async createProduct(): Promise<void> {
    if (!this.editable() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.persist(); // vacía el autosave pendiente; no crea borrador si está vacío
      const returnTo = `${this.cfg().basePath}/${this.invoiceId() ?? 'new'}`;
      await this.router.navigate(['/gen-masters/inventory/products/list'], {
        queryParams: buildReturnQuery(returnTo),
      });
    } catch (e) {
      this.fail('No se pudo guardar el borrador', e);
    } finally {
      this.busy.set(false);
    }
  }

  /** Atajo a Clientes/Proveedores: asegura el borrador guardado y deja el rastro para volver. */
  async createClient(): Promise<void> {
    if (!this.editable() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.persist();
      const returnTo = `${this.cfg().basePath}/${this.invoiceId() ?? 'new'}`;
      await this.router.navigate(['/gen-masters/third-parties/list'], {
        queryParams: buildReturnQuery(returnTo),
      });
    } catch (e) {
      this.fail('No se pudo guardar el borrador', e);
    } finally {
      this.busy.set(false);
    }
  }

  // --- edición de cabecera y líneas ---

  onClientChange(id: string | null): void {
    this.clientId.set(id);
    this.markDirty();
  }

  onSupplierInvoiceNumberChange(value: string): void {
    this.supplierInvoiceNumber.set(value ?? '');
    this.supplierNumberError.set(null); // el usuario corrige el número: se reintenta con el autosave
    this.markDirty();
  }

  onPaymentMethodChange(id: string | null): void {
    this.paymentMethodId.set(id);
    this.paymentMethodName.set(null);
    this.markDirty();
  }

  onDateChange(value: string): void {
    this.date.set(value || todayIso());
    this.markDirty();
  }

  addProduct(): void {
    const product = this.products().find((p) => p.id === this.selectedProductId);
    if (!product) return;

    const existing = this.lines().findIndex((l) => l.productId === product.id);
    if (existing >= 0) {
      this.setQuantity(existing, this.lines()[existing].cantidad + 1);
    } else {
      this.lines.update((lines) => [
        ...lines,
        {
          productId: product.id,
          productName: product.name,
          cantidad: 1,
          precioCatalogoCents: product.priceCents,
          precioUnitarioCents: product.priceCents,
          precioEditado: false, // sigue al catálogo hasta que el usuario edite el precio
          // IVA solo de vista previa (puede ser null = sin dato); tras el primer guardado lo fija el back
          ivaCatalogoPct: product.ivaPct,
          ivaPct: product.ivaPct,
          ivaEditado: false,
          // Desglose de vista previa (impuestos de la categoría): con elementos la celda es de solo lectura
          taxes: product.taxes ?? [],
        },
      ]);
      this.markDirty();
    }
    this.selectedProductId = null;
  }

  // Inventario solo admite cantidades ENTERAS y el back exige cantidad > 0 (aun en borrador): el mínimo es MIN_QUANTITY (1).
  // Un valor con decimales se toma por su parte entera; uno vacío, ≤ 0 o menor a 1 vuelve al último valor válido (para
  // quitar la línea está el tacho), así el autosave no falla por una línea en 0.
  setQuantity(index: number, value: number | null): void {
    const rounded = value == null ? NaN : wholeQty(value);
    if (rounded >= MIN_QUANTITY) {
      this.updateLine(index, { cantidad: rounded });
      return;
    }
    // Sin cambio real: no se marca sucio, solo se recrea la fila para que el input vuelva a mostrar el valor válido
    this.lines.update((lines) => lines.map((l, i) => (i === index ? { ...l } : l)));
  }

  // El precio editado por el usuario prevalece (`precioEditado`: viaja como override aunque coincida con el catálogo);
  // el de catálogo queda como referencia. Vaciar el campo devuelve la línea al catálogo (igual que el IVA), nunca a $0.
  setUnitPrice(index: number, pesos: number | null): void {
    if (pesos == null) {
      this.updateLine(index, { precioUnitarioCents: this.lines()[index]?.precioCatalogoCents, precioEditado: false });
      return;
    }
    this.updateLine(index, { precioUnitarioCents: pesosToCents(pesos), precioEditado: true });
  }

  // El IVA editado por el usuario prevalece (se marca `ivaEditado` para que viaje como override aunque coincida con la
  // referencia); el que resuelve el back queda como referencia. Vaciar el campo devuelve la línea al catálogo.
  setIva(index: number, pct: number | null): void {
    if (pct == null) {
      this.updateLine(index, { ivaPct: this.lines()[index]?.ivaCatalogoPct ?? null, ivaEditado: false });
      return;
    }
    this.updateLine(index, { ivaPct: Math.min(100, Math.max(0, pct)), ivaEditado: true });
  }

  // --- edición desde los inputs numéricos ---
  // p-inputNumber emite el modelo en CADA tecla. Si se validara/revirtiera ahí, un valor intermedio ("0" camino a
  // "0,5", o el campo vacío) se pisaría y la fila se recrearía perdiendo el foco. Por eso mientras se teclea solo se
  // aplica un valor ya válido (un intermedio inválido se ignora y el campo conserva lo tecleado) y la normalización
  // (entero, mínimo 1, vacío -> último válido / catálogo) ocurre al salir del campo (onBlur).

  onQuantityInput(index: number, value: number | null): void {
    // Solo un entero ≥ 1 se aplica mientras se teclea
    if (value != null && isWholeQty(value) && value >= MIN_QUANTITY) this.updateLine(index, { cantidad: wholeQty(value) });
  }

  commitQuantity(index: number, field: InputNumber): void {
    const current = this.lines()[index]?.cantidad;
    if (current === undefined) return;
    const typed = field.value == null ? NaN : wholeQty(field.value);
    if (typed >= MIN_QUANTITY) {
      if (typed !== current) this.updateLine(index, { cantidad: typed });
      this.showInputValue(field, typed);
    } else {
      this.showInputValue(field, current); // vacío o ≤ 0: vuelve al último valor válido
    }
  }

  onUnitPriceInput(index: number, pesos: number | null): void {
    if (pesos != null) this.setUnitPrice(index, pesos);
  }

  commitUnitPrice(index: number, field: InputNumber): void {
    const line = this.lines()[index];
    if (!line) return;
    if (field.value == null) this.setUnitPrice(index, null); // vacío: vuelve al catálogo
    this.showInputValue(field, centsToPesos(this.lines()[index].precioUnitarioCents));
  }

  onIvaInput(index: number, pct: number | null): void {
    if (pct != null) this.setIva(index, pct);
  }

  commitIva(index: number, field: InputNumber): void {
    if (!this.lines()[index]) return;
    if (field.value == null) this.setIva(index, null); // vacío: vuelve al catálogo
    this.showInputValue(field, this.lines()[index].ivaPct);
  }

  // Deja el input mostrando `value` ya normalizado (el modelo del campo y el texto en pantalla)
  private showInputValue(field: InputNumber, value: number | null): void {
    field.writeValue(value);
    field.input.nativeElement.value = value == null ? '' : field.formatValue(value);
  }

  // Regla de presentación: con impuestos de categoría el desglose es de SOLO LECTURA; sin ellos (IVA por defecto, documento
  // viejo o IVA editado a mano) queda la casilla editable de % como siempre
  readonly hasTaxBreakdown = hasTaxBreakdown;

  // Las filas se identifican por producto (no por referencia del objeto): editar una línea no recrea su fila ni el input
  readonly trackLine = (_: number, line: SaleInvoiceLine): string => line.productId;

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
    this.markDirty();
  }

  // --- acciones ---

  async saveDraft(): Promise<void> {
    // Reentrada: mientras hay una acción en curso, los clics extra se ignoran (aunque el botón tarde en deshabilitarse)
    if (!this.editable() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.persist(true);
      this.toast('success', 'Borrador guardado', 'Los cambios se guardaron correctamente.');
    } catch (e) {
      this.fail('No se pudo guardar', e);
    } finally {
      this.busy.set(false);
    }
  }

  confirmEmit(): void {
    if (this.busy()) return;
    const error = this.validateForEmit();
    if (error) {
      this.toast('warn', 'No se puede emitir', error);
      return;
    }
    this.confirmation.confirm({
      header: 'Emitir factura',
      icon: 'pi pi-exclamation-triangle',
      message: 'Al emitir se asignará el número y la factura ya no podrá modificarse ni eliminarse. ¿Continuar?',
      acceptLabel: 'Emitir factura',
      rejectLabel: 'Cancelar',
      accept: () => this.emit(),
    });
  }

  confirmDelete(): void {
    if (this.busy()) return;
    this.confirmation.confirm({
      header: 'Eliminar borrador',
      icon: 'pi pi-exclamation-triangle',
      message: '¿Seguro que deseas eliminar este borrador? Esta acción no se puede deshacer.',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => this.deleteDraft(),
    });
  }

  // Vuelve a la pantalla de origen (`state.from`, que fijan los listados al abrir la factura). Sin origen
  // (F5, link directo, retorno desde Terceros/Productos) una factura emitida vuelve a "Ver facturas" y un
  // borrador al menú de Facturación. No usa location.back(): tras ir a crear un tercero/producto y volver,
  // "atrás" regresaría a esa pantalla en vez de salir de la factura.
  goBack(): void {
    const from = window.history.state?.from;
    const target =
      typeof from === 'string' && from.startsWith('/billing')
        ? from
        : this.status() === 'BORRADOR'
          ? this.cfg().basePath
          : `${this.cfg().basePath}/list`;
    this.router.navigate([target]);
  }

  // --- internos ---

  private async emit(): Promise<void> {
    if (this.busy()) return; // bandera de reentrada: N clics => una sola emisión
    this.busy.set(true);
    try {
      await this.persist(); // asegura que lo último editado quede guardado antes de emitir
      this.writes++;
      let emitted: SaleInvoice;
      try {
        emitted = await firstValueFrom(this.api.emit(this.invoiceId()!, this.version));
      } finally {
        this.writes++; // la escritura terminó (con o sin respuesta): un GET anterior ya no es confiable
      }
      this.applyInvoice(emitted);
      this.loadReturns(emitted.id, emitted.status); // habilita el botón "Devolución"
      this.toast('success', 'Factura emitida', `Se asignó el número ${emitted.number}.`);
    } catch (e) {
      this.fail('No se pudo emitir', e);
      // Sin respuesta (timeout / 5xx) el back pudo haber emitido igual: se recarga para mostrar el estado real
      if (e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500)) this.reloadDocument();
    } finally {
      this.busy.set(false);
    }
  }

  private async deleteDraft(): Promise<void> {
    if (this.busy()) return;
    this.dirty = false; // evita que ngOnDestroy vuelva a guardar lo que se acaba de borrar
    this.busy.set(true);
    try {
      // Espera el guardado en curso: si es el que crea el borrador, el id solo se conoce al terminar
      // (sin esto se borraría "nada" y quedaría un borrador huérfano)
      await this.saveChain;
      this.dirty = false; // un guardado fallido durante la espera lo vuelve a marcar
      const id = this.invoiceId();
      this.writes++;
      if (id) await firstValueFrom(this.api.deleteDraft(id, this.version));
      this.toast('success', 'Borrador eliminado', 'El borrador fue eliminado.');
      this.router.navigate([this.cfg().basePath]);
    } catch (e) {
      this.fail('No se pudo eliminar', e);
    } finally {
      this.busy.set(false);
    }
  }

  private validateForEmit(): string | null {
    if (!this.clientId()) return `Debes seleccionar un ${this.cfg().counterpartyLower}.`;
    if (this.kind() === 'PURCHASE' && !this.supplierInvoiceNumber().trim()) {
      return 'Debes ingresar el N.º de factura del proveedor.';
    }
    const paymentError = this.paymentEmitError();
    if (paymentError) return paymentError;
    const missingTax = this.withholdingsMissingTax()[0];
    if (missingTax) return `Elige el impuesto de ${missingTax.label}.`;
    if (this.lines().length === 0) return 'Agrega al menos un ítem a la factura.';
    if (this.lines().some((l) => !(l.cantidad > 0))) return 'Todos los ítems deben tener cantidad mayor a cero.';
    // Un borrador histórico puede traer decimales: Inventario los rechazaría al emitir
    if (this.lines().some((l) => !isWholeQty(l.cantidad))) {
      return 'Inventario solo admite cantidades enteras: corrige las cantidades con decimales antes de emitir.';
    }
    if (this.totals().totalCents < 0) {
      return 'Las retenciones superan el subtotal más los impuestos. Revisa los impuestos elegidos en las retenciones.';
    }
    return null;
  }

  // Método de pago obligatorio al emitir una VENTA; el back lo vuelve a validar
  private paymentEmitError(): string | null {
    if (!this.hasPayment()) return null;
    if (this.paymentMethodsState() === 'ready' && this.paymentMethods().length === 0) return NO_PAYMENT_METHODS_MESSAGE;
    if (!this.paymentMethodId()) return 'Selecciona el método de pago.';
    if (this.paymentMethodsState() === 'ready' && !this.selectedPaymentMethod()) {
      return 'El método de pago elegido ya no está activo. Selecciona otro.';
    }
    return null;
  }

  private updateLine(index: number, patch: Partial<SaleInvoiceLine>): void {
    this.lines.update((lines) => lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
    this.saveState.set('pending');
    this.autosave$.next();
  }

  /** Encola un guardado del estado ACTUAL del formulario. `force` guarda aunque no haya cambios. */
  private persist(force = false): Promise<SaleInvoice | null> {
    const run = async (): Promise<SaleInvoice | null> => {
      const hasContent =
        !!this.invoiceId() ||
        !!this.clientId() ||
        !!this.supplierInvoiceNumber().trim() ||
        this.lines().length > 0;
      if ((!this.dirty && !force) || !hasContent) {
        this.dirty = false;
        this.saveState.set(this.invoiceId() ? 'saved' : 'idle');
        return null;
      }
      this.dirty = false;
      this.saveState.set('saving');
      this.writes++;
      try {
        const saved = await firstValueFrom(
          this.api.saveDraft({
            id: this.invoiceId() ?? undefined,
            kind: this.kind(),
            clientId: this.clientId(),
            supplierInvoiceNumber: this.supplierInvoiceNumber(),
            date: this.date(),
            lines: this.lines(),
            payment: this.payment(),
            withholdings: this.withholdingPayload(), // reemplazo total; [] quita las retenciones
            version: this.version, // la de la respuesta anterior (la cadena serializa los guardados)
          }),
        );
        this.writes++; // la escritura terminó: un GET que salió antes ya no es confiable
        this.version = saved.version ?? null;
        this.serverWithholdings.set(saved.withholdings ?? []);
        this.serverSubtotal.set(saved.totals?.subtotalCents ?? null);
        this.autosaveFailing = false;
        this.supplierNumberError.set(null);
        this.adoptSavedLine(saved);
        if (!this.invoiceId()) {
          this.invoiceId.set(saved.id);
          // Cambia la URL a /sale/:id (o /purchase/:id) sin recrear el componente
          // Conserva history.state (`from`) para que "Volver" siga sabiendo a dónde ir
          // Si el componente ya se destruyó (guardado de ngOnDestroy) no se toca la URL de la pantalla actual
          if (!this.destroyed) {
            this.location.replaceState(`${this.cfg().basePath}/${saved.id}`, '', window.history.state);
          }
        }
        // Si el usuario siguió editando durante el guardado, queda pendiente
        this.saveState.set(this.dirty ? 'pending' : 'saved');
        return saved;
      } catch (e) {
        this.writes++;
        this.dirty = true;
        this.saveState.set('idle');
        throw e;
      }
    };
    const result = this.saveChain.then(run);
    this.saveChain = result.catch(() => undefined);
    return result;
  }

  // El back es la fuente de verdad del IVA y de los precios sin editar: tras guardar, cada línea toma ivaPct /
  // ivaCatalogoPct / ivaEditado / taxes (desglose) y precioCatalogoCents / precioEditado de la respuesta, y el precio unitario solo si la
  // línea sigue al catálogo (`precioEditado` false; un override del usuario no se pisa). Todo salvo que el usuario haya
  // vuelto a editar mientras se guardaba (ese cambio queda pendiente y manda).
  private adoptSavedLine(saved: SaleInvoice): void {
    const current = this.lines();
    const fresh = saved.lines;
    if (this.dirty || !fresh || fresh.length !== current.length) return;
    if (fresh.some((l, i) => l.productId !== current[i].productId)) return;
    const pick = <T>(server: T | undefined, local: T): T => (server !== undefined ? server : local);
    let changed = false;
    const merged = current.map((l, i) => {
      const s = fresh[i];
      const precioEditado = pick(s.precioEditado, l.precioEditado);
      const next: SaleInvoiceLine = {
        ...l,
        lineNo: pick(s.lineNo, l.lineNo),
        ivaPct: pick(s.ivaPct, l.ivaPct),
        ivaCatalogoPct: pick(s.ivaCatalogoPct, l.ivaCatalogoPct),
        ivaEditado: pick(s.ivaEditado, l.ivaEditado),
        taxes: pick(s.taxes, l.taxes),
        precioCatalogoCents: pick(s.precioCatalogoCents, l.precioCatalogoCents),
        precioEditado,
        precioUnitarioCents:
          precioEditado === false ? pick(s.precioUnitarioCents, l.precioUnitarioCents) : l.precioUnitarioCents,
      };
      if (
        next.ivaPct !== l.ivaPct ||
        next.ivaCatalogoPct !== l.ivaCatalogoPct ||
        next.ivaEditado !== l.ivaEditado ||
        !sameTaxes(next.taxes, l.taxes) ||
        next.lineNo !== l.lineNo ||
        next.precioCatalogoCents !== l.precioCatalogoCents ||
        next.precioEditado !== l.precioEditado ||
        next.precioUnitarioCents !== l.precioUnitarioCents
      ) {
        changed = true;
        return next;
      }
      return l;
    });
    if (changed) this.lines.set(merged);
  }

  private applyInvoice(invoice: SaleInvoice): void {
    this.invoiceId.set(invoice.id);
    this.number.set(invoice.number);
    this.status.set(invoice.status);
    this.clientId.set(invoice.clientId);
    this.frozenClientName.set(invoice.clientName ?? null);
    this.frozenClientDocument.set(invoice.clientDocument ?? null);
    this.clientContact.set({
      address: invoice.clientAddress ?? null,
      city: invoice.clientCity ?? null,
      phone: invoice.clientPhone ?? null,
      email: invoice.clientEmail ?? null,
    });
    this.issuer.set(invoice.issuer ?? null);
    this.verificationCode.set(invoice.verificationCode ?? null);
    this.supplierInvoiceNumber.set(invoice.supplierInvoiceNumber ?? '');
    this.date.set(invoice.date);
    this.lines.set(invoice.lines);
    this.serverTotals.set(invoice.totals ?? null);
    const payment = invoice.payment ?? null;
    this.paymentMethodId.set(payment?.methodId ?? null);
    this.paymentMethodName.set(payment?.methodName ?? null);
    this.applyWithholdings(invoice);
    this.version = invoice.version ?? null;
    this.annulReason.set(invoice.annulReason ?? null);
    this.dirty = false;
    this.saveState.set(invoice.status === 'BORRADOR' ? 'saved' : 'idle');
  }

  // Restaura casillas y selects desde las retenciones del back (el id del impuesto se empareja como texto con el catálogo)
  private applyWithholdings(invoice: SaleInvoice): void {
    const list = invoice.withholdings ?? [];
    // Una casilla marcada SIN impuesto no existe en el back: un refresco no debe desmarcarla
    const unsaved = this.withholdings().filter((c) => !this.withholdingTaxes()[c] && !list.some((w) => w.code === c));
    this.withholdings.set([...list.map((w) => w.code as string), ...(invoice.status === 'BORRADOR' ? unsaved : [])]);
    this.withholdingTaxes.set(Object.fromEntries(list.map((w) => [w.code, String(w.taxId)])));
    this.restoredTaxes.set(
      Object.fromEntries(list.map((w) => [w.code, { id: String(w.taxId), name: w.taxName, rate: w.ratePct }])),
    );
    this.serverWithholdings.set(list);
    this.serverSubtotal.set(invoice.totals?.subtotalCents ?? null);
  }

  private toast(severity: 'success' | 'warn' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail });
  }

  private errorMessage(e: unknown): string {
    return billingErrorMessage(e); // incluye BILLING_IDEMPOTENCY_CONFLICT y BILLING_CONCURRENT_MODIFICATION (409)
  }

  // Toast de error; ante un 409 por bloqueo optimista además se recarga la versión vigente del documento
  private fail(summary: string, e: unknown): void {
    this.noteDuplicateSupplierNumber(e);
    this.toast('error', summary, this.errorMessage(e));
    if (isConcurrentModification(e)) this.reloadDocument();
  }

  // Un duplicado no rompe la pantalla: el borrador conserva lo ya guardado y el mensaje queda visible bajo el campo
  private noteDuplicateSupplierNumber(e: unknown): void {
    if (isDuplicateSupplierInvoice(e)) this.supplierNumberError.set(this.errorMessage(e));
  }

  private reloadDocument(): void {
    const id = this.invoiceId();
    if (!id) return;
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invoice) => {
          this.applyInvoice(invoice);
          if (invoice.status !== 'BORRADOR') this.loadReturns(invoice.id, invoice.status);
        },
        error: () => undefined, // el error original ya se avisó
      });
  }

  // Helpers expuestos a la plantilla
  lineSubtotal = (line: SaleInvoiceLine): number => lineSubtotalOf(line, this.editable());
  toPesos = centsToPesos;
  // Decimales a mostrar en el input de cantidad: 0 (enteros); una cantidad histórica con decimales se muestra tal cual
  // (con maxFractionDigits=0 se vería redondeada) hasta que el usuario la corrija
  qtyFractionDigits = (cantidad: number): number => (isWholeQty(cantidad) ? 0 : 3);
}
