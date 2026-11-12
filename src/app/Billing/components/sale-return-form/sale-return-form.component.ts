import { DatePipe, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { Subject, debounceTime, firstValueFrom, forkJoin } from 'rxjs';
import { InvoiceStatus, InvoiceTotals } from '../../models/billing-sale-invoice.model';
import { ReturnAvailabilityLine, SaleReturn } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { billingErrorMessage, isConcurrentModification } from '../../utils/billing-error';
import { ONLY_FRACTION_LEFT_MESSAGE } from '../../utils/full-return';
import { MIN_QUANTITY, isWholeQty, wholeQty } from '../../utils/money';
import { calcReturnTotals, returnLineSubtotalOf } from '../../utils/sale-return';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';
import { BillingTaxBreakdownComponent } from '../billing-tax-breakdown/billing-tax-breakdown.component';

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Fila de la tabla: disponibilidad de la línea original (por lineNo) + lo que el usuario devuelve.
// `sold` es null en una devolución emitida cuando el back no trae lo vendido (se muestra "—", no 0).
type ReturnRow = Omit<ReturnAvailabilityLine, 'sold'> & {
  sold: number | null;
  cantidadDevuelta: number;
  subtotalCents?: number; // subtotal del back (solo en devoluciones no editables)
};

const AUTOSAVE_DEBOUNCE_MS = 800;

const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Formulario de devolución de venta Y de compra (mismas reglas). El tipo llega por `data.kind` en
// sale|purchase/:invoiceId/return/new; en return/:id (sin data) se toma de la devolución cargada.
// clientName = contraparte: cliente en ventas, proveedor en compras.
@Component({
  selector: 'app-sale-return-form',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    SharedModule,
    InputNumberModule,
    TableModule,
    CopCentsPipe,
    BillingStatusBadgeComponent,
    BillingTaxBreakdownComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './sale-return-form.component.html',
})
export class SaleReturnFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(BillingSaleReturnApi);
  private readonly invoiceApi = inject(BillingSaleInvoiceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  // Estado de la devolución
  kind = signal<DocumentKind>('SALE');
  cfg = computed(() => DOCUMENT_KIND_CONFIG[this.kind()]);
  returnId = signal<string | null>(null);
  invoiceId = signal<string>('');
  number = signal<string | null>(null);
  status = signal<InvoiceStatus>('BORRADOR');
  originalNumber = signal<string | null>(null);
  originalDate = signal<string>('');
  clientName = signal<string | null>(null);
  supplierInvoiceNumber = signal<string | null>(null); // solo compras
  date = signal<string>(todayIso());
  reason = signal<string>('');
  rows = signal<ReturnRow[]>([]);
  // Totales del back (solo mandan en documentos no editables; en borrador se calcula con las filas)
  serverTotals = signal<InvoiceTotals | null>(null);
  annulReason = signal<string | null>(null);

  // UI
  loading = signal(true);
  busy = signal(false);
  saveState = signal<SaveState>('idle');

  // Solo el borrador es editable; EMITIDA/ANULADA son de solo lectura total
  editable = computed(() => this.status() === 'BORRADOR');
  totals = computed(() => (this.editable() ? calcReturnTotals(this.rows()) : (this.serverTotals() ?? calcReturnTotals(this.rows()))));
  // "Devolver todo" tiene sentido si queda algo por devolver que aún no esté en las casillas
  // (en unidades enteras: una fracción < 1 de una factura histórica no cuenta)
  canReturnAll = computed(() => this.rows().some((r) => wholeQty(r.available) > r.cantidadDevuelta));

  private dirty = false;
  private version: number | null = null; // versión del borrador según la última respuesta del back (bloqueo optimista)
  private destroyed = false;
  private autosaveFailing = false; // racha de fallos del autosave: se avisa una sola vez
  private readonly autosave$ = new Subject<void>();
  // Cadena de guardados: serializa las escrituras para no crear borradores duplicados
  private saveChain: Promise<unknown> = Promise.resolve();

  ngOnInit(): void {
    this.kind.set(this.route.snapshot.data['kind'] ?? 'SALE');
    this.autosave$
      .pipe(debounceTime(AUTOSAVE_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.persist().catch((e) => {
          this.saveState.set('error');
          // Un aviso por racha de fallos (salvo conflicto de versión, que además recarga el documento)
          if (isConcurrentModification(e)) this.fail('No se pudo guardar', e);
          else if (!this.autosaveFailing) {
            this.autosaveFailing = true;
            this.toast('error', 'No se pudo guardar', this.errorMessage(e));
          }
        }),
      );

    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadExisting(id);
    else this.loadNew(this.route.snapshot.paramMap.get('invoiceId') ?? '');
  }

  ngOnDestroy(): void {
    this.destroyed = true; // el guardado pendiente no debe tocar la URL (location.replaceState) de otra pantalla
    // Al salir de la pantalla se persiste lo pendiente (el mock escribe de forma síncrona)
    if (this.dirty && this.editable()) {
      this.persist().catch((e) => this.toast('error', 'No se pudo guardar el borrador al salir', this.errorMessage(e)));
    }
  }

  // --- carga ---

  // Devolución nueva: los datos salen de la factura original y de su disponibilidad
  private loadNew(invoiceId: string): void {
    this.invoiceId.set(invoiceId);
    forkJoin([this.invoiceApi.getById(invoiceId), this.api.getAvailability(invoiceId)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([invoice, availability]) => {
          this.kind.set(invoice.kind); // la factura manda sobre la ruta
          if (!availability.some((a) => wholeQty(a.available) >= MIN_QUANTITY)) {
            const onlyFractions = availability.some((a) => a.available > 0);
            this.toast(
              'warn',
              'Sin cantidades disponibles',
              onlyFractions ? ONLY_FRACTION_LEFT_MESSAGE : 'Esta factura ya fue devuelta por completo.',
            );
            this.router.navigate([this.cfg().basePath, invoiceId]);
            return;
          }
          this.originalNumber.set(invoice.number);
          this.originalDate.set(invoice.date);
          this.clientName.set(invoice.clientName);
          this.supplierInvoiceNumber.set(invoice.supplierInvoiceNumber ?? null);
          this.rows.set(availability.map((a) => ({ ...a, cantidadDevuelta: 0 })));
          this.loading.set(false);
        },
        error: (e) => {
          this.toast('error', 'No se puede devolver', this.errorMessage(e));
          this.router.navigate([this.cfg().basePath, invoiceId]);
        },
      });
  }

  // `reload`: recarga tras un conflicto de versión; si falla solo avisa (no saca al usuario de la pantalla)
  private loadExisting(id: string, reload = false): void {
    this.api
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saleReturn) => {
          this.applyReturn(saleReturn);
          if (saleReturn.status !== 'BORRADOR') {
            this.loading.set(false);
            return;
          }
          // Un borrador sigue siendo editable: necesita la disponibilidad vigente por línea
          this.api
            .getAvailability(saleReturn.invoiceId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (availability) => {
                let adjusted = false;
                this.rows.set(
                  availability.map((a) => {
                    // Se enlaza por lineNo de la factura original (sourceLineNo); sin él (datos antiguos) por producto
                    const saved =
                      saleReturn.lines.find((l) =>
                        l.sourceLineNo != null ? l.sourceLineNo === a.lineNo : l.productId === a.productId,
                      )?.cantidadDevuelta ?? 0;
                    const capped = Math.min(saved, a.available);
                    // Borrador histórico con decimales: se lleva a la parte entera (Inventario solo admite enteros)
                    const whole = Math.min(wholeQty(capped), this.maxReturnable(a));
                    if (whole !== capped) adjusted = true;
                    return { ...a, cantidadDevuelta: whole };
                  }),
                );
                this.loading.set(false);
                if (adjusted) {
                  this.toast(
                    'warn',
                    'Cantidades ajustadas',
                    'Inventario solo admite cantidades enteras: las cantidades con decimales del borrador se ajustaron a la parte entera.',
                  );
                  this.markDirty(); // se guarda el ajuste
                }
              },
              error: (e) => {
                this.toast('error', 'No se pudo cargar la disponibilidad', this.errorMessage(e));
                if (!reload) this.router.navigate([this.cfg().basePath, saleReturn.invoiceId]);
              },
            });
        },
        error: () => {
          this.toast('error', 'Devolución no encontrada', 'No existe la devolución solicitada.');
          if (!reload) this.router.navigate([`${this.cfg().basePath}/returns`]);
        },
      });
  }

  // --- edición ---

  onDateChange(value: string): void {
    this.date.set(value || todayIso());
    this.markDirty();
  }

  onReasonChange(value: string): void {
    this.reason.set(value ?? '');
    this.markDirty();
  }

  // Inventario solo admite cantidades ENTERAS: la cantidad se limita a [0, parte entera del disponible] y un valor con
  // decimales se toma por su parte entera; 0 = no se devuelve esa línea (no se envía al back)
  setQuantity(index: number, value: number | null): void {
    this.rows.update((rows) =>
      rows.map((r, i) =>
        i === index ? { ...r, cantidadDevuelta: Math.min(this.maxReturnable(r), Math.max(0, wholeQty(value ?? 0))) } : r,
      ),
    );
    this.markDirty();
  }

  // Una sola acción: llena todas las casillas con lo disponible (entero). Después se puede ajustar cada cantidad a mano.
  // En una factura histórica con decimales (disponible 2.5) se ofrece la parte entera (2): la fracción no se puede devolver.
  returnAll(): void {
    if (!this.editable() || !this.canReturnAll()) return;
    this.rows.update((rows) => rows.map((r) => ({ ...r, cantidadDevuelta: this.maxReturnable(r) })));
    this.markDirty();
  }

  /** Máximo que se puede devolver en la fila: la parte entera de lo disponible. */
  maxReturnable = (row: Pick<ReturnRow, 'available'>): number => wholeQty(row.available);

  // Decimales a mostrar en la casilla: 0 (enteros); un borrador histórico con decimales se muestra tal cual
  qtyFractionDigits = (cantidad: number): number => (isWholeQty(cantidad) ? 0 : 3);

  // --- acciones ---

  confirmEmit(): void {
    if (this.busy()) return;
    const error = this.validateForEmit();
    if (error) {
      this.toast('warn', 'No se puede emitir', error);
      return;
    }
    this.confirmation.confirm({
      header: 'Emitir devolución',
      icon: 'pi pi-exclamation-triangle',
      message: `Al emitir se asignará el número de la ${this.cfg().noteShort} y la devolución ya no podrá modificarse ni eliminarse. ¿Continuar?`,
      acceptLabel: 'Emitir devolución',
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

  // Una devolución emitida no se anula (decisión de negocio): no hay botón ni diálogo de anulación.
  // El endpoint de anular devolución sigue en el back y en BillingSaleReturnApi.annul, sin uso desde la UI.

  // La devolución siempre vuelve a su factura original (única pantalla desde la que se llega a ella)
  goBack(): void {
    this.router.navigate([this.cfg().basePath, this.invoiceId()]);
  }

  // --- internos ---

  private async emit(): Promise<void> {
    if (this.busy()) return; // bandera de reentrada: N clics => una sola emisión
    this.busy.set(true);
    try {
      await this.persist(true); // asegura que lo último editado quede guardado antes de emitir
      const emitted = await firstValueFrom(this.api.emit(this.returnId()!, this.version));
      this.applyReturn(emitted);
      this.toast('success', 'Devolución emitida', `Se asignó el número ${emitted.number}.`);
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
      const id = this.returnId();
      if (id) await firstValueFrom(this.api.deleteDraft(id, this.version));
      this.toast('success', 'Borrador eliminado', 'El borrador fue eliminado.');
      this.router.navigate([this.cfg().basePath, this.invoiceId()]);
    } catch (e) {
      this.fail('No se pudo eliminar', e);
    } finally {
      this.busy.set(false);
    }
  }

  private validateForEmit(): string | null {
    if (!this.rows().some((r) => r.cantidadDevuelta > 0)) return 'Indica la cantidad a devolver de al menos un producto.';
    // Un borrador histórico puede traer decimales: Inventario los rechazaría al emitir
    if (this.rows().some((r) => !isWholeQty(r.cantidadDevuelta))) {
      return 'Inventario solo admite cantidades enteras: corrige las cantidades con decimales antes de emitir.';
    }
    if (!this.reason().trim()) return 'El motivo de la devolución es obligatorio.';
    return null;
  }

  private markDirty(): void {
    this.dirty = true;
    this.saveState.set('pending');
    this.autosave$.next();
  }

  /** Encola un guardado del estado ACTUAL. `force` guarda aunque no haya cambios. */
  private persist(force = false): Promise<SaleReturn | null> {
    const run = async (): Promise<SaleReturn | null> => {
      // El borrador se crea solo cuando hay algo que guardar: alguna cantidad o el motivo
      const hasContent =
        !!this.returnId() || this.rows().some((r) => r.cantidadDevuelta > 0) || !!this.reason().trim();
      if ((!this.dirty && !force) || !hasContent) {
        this.dirty = false;
        this.saveState.set(this.returnId() ? 'saved' : 'idle');
        return null;
      }
      this.dirty = false;
      this.saveState.set('saving');
      try {
        const saved = await firstValueFrom(
          this.api.saveDraft({
            id: this.returnId() ?? undefined,
            invoiceId: this.invoiceId(),
            date: this.date(),
            reason: this.reason(),
            // Por lineNo de la factura original y solo las que se devuelven (el back exige cantidad > 0)
            lines: this.rows()
              .filter((r) => r.cantidadDevuelta > 0)
              .map((r) => ({ lineNo: r.lineNo, cantidad: r.cantidadDevuelta })),
            version: this.version, // la de la respuesta anterior (la cadena serializa los guardados)
          }),
        );
        this.version = saved.version ?? null;
        this.autosaveFailing = false;
        if (!this.returnId()) {
          this.returnId.set(saved.id);
          // Cambia la URL a /return/:id sin recrear el componente
          // Si el componente ya se destruyó (guardado de ngOnDestroy) no se toca la URL de la pantalla actual
          if (!this.destroyed) this.location.replaceState(`/billing/return/${saved.id}`);
        }
        // Si el usuario siguió editando durante el guardado, queda pendiente
        this.saveState.set(this.dirty ? 'pending' : 'saved');
        return saved;
      } catch (e) {
        this.dirty = true;
        this.saveState.set('idle');
        throw e;
      }
    };
    const result = this.saveChain.then(run);
    this.saveChain = result.catch(() => undefined);
    return result;
  }

  // Aplica el documento. En BORRADOR las filas se construyen aparte (con la disponibilidad);
  // en EMITIDA/ANULADA se muestran las líneas congeladas del documento.
  private applyReturn(saleReturn: SaleReturn): void {
    this.kind.set(saleReturn.kind);
    this.returnId.set(saleReturn.id);
    this.invoiceId.set(saleReturn.invoiceId);
    this.number.set(saleReturn.number);
    this.status.set(saleReturn.status);
    this.originalNumber.set(saleReturn.originalNumber);
    this.originalDate.set(saleReturn.originalDate);
    this.clientName.set(saleReturn.clientName);
    this.supplierInvoiceNumber.set(saleReturn.supplierInvoiceNumber ?? null);
    this.date.set(saleReturn.date);
    this.reason.set(saleReturn.reason);
    this.annulReason.set(saleReturn.annulReason ?? null);
    this.serverTotals.set(saleReturn.totals ?? null);
    this.version = saleReturn.version ?? null;
    if (saleReturn.status !== 'BORRADOR') {
      this.rows.set(
        saleReturn.lines.map((l, index) => ({
          lineNo: l.sourceLineNo ?? index + 1,
          productId: l.productId,
          productName: l.productName,
          sold: l.cantidadVendida ?? null, // el back no trae lo vendido en la devolución: se muestra "—"

          returned: 0,
          available: 0,
          cantidadDevuelta: l.cantidadDevuelta,
          precioUnitarioCents: l.precioUnitarioCents,
          ivaPct: l.ivaPct,
          ...(l.subtotalCents != null ? { subtotalCents: l.subtotalCents } : {}),
          ...(l.taxes?.length ? { taxes: l.taxes } : {}), // desglose heredado de la línea original
        })),
      );
    }
    this.dirty = false;
    this.saveState.set(saleReturn.status === 'BORRADOR' ? 'saved' : 'idle');
  }

  private toast(severity: 'success' | 'warn' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail });
  }

  private errorMessage(e: unknown): string {
    return billingErrorMessage(e); // incluye BILLING_IDEMPOTENCY_CONFLICT y BILLING_CONCURRENT_MODIFICATION (409)
  }

  // Toast de error; ante un 409 por bloqueo optimista además se recarga la versión vigente del documento
  private fail(summary: string, e: unknown): void {
    this.toast('error', summary, this.errorMessage(e));
    if (isConcurrentModification(e)) this.reloadDocument();
  }

  private reloadDocument(): void {
    const id = this.returnId();
    if (id) this.loadExisting(id, true);
  }

  // Helper expuesto a la plantilla
  rowSubtotal = (row: ReturnRow): number => returnLineSubtotalOf(row, this.editable());
}
