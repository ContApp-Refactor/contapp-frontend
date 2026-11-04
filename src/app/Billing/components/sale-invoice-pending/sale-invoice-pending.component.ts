import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { BillingClient, SaleInvoice, SaleInvoiceLineInput } from '../../models/billing-sale-invoice.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind, KIND_FILTER_OPTIONS } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingCounterpartyCatalog } from '../../services/billing-counterparty-catalog';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { billingErrorMessage, isConcurrentModification, skippedToast } from '../../utils/billing-error';
import { isoDateText, isoDateTimeText } from '../../utils/format';
import { centsToPesos, invoiceTotals } from '../../utils/money';
import { BillingKindTagComponent } from '../billing-kind-tag/billing-kind-tag.component';
import { SaleInvoicePreviewComponent } from '../sale-invoice-preview/sale-invoice-preview.component';

const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Fila de la tabla de pendientes: campos planos para el buscador y los filtros de columna
interface PendingRow {
  draft: SaleInvoice;
  counterparty: string;
  supplierInvoiceNumber: string;
  dateText: string;
  kindLabel: string;
  itemsCount: number; // "Ítems": cantidad de productos distintos del borrador
  totalPesos: number;
  totalCents: number;
  updatedText: string;
}

// Lista los borradores de venta y de compra para retomarlos, duplicarlos o eliminarlos
@Component({
  selector: 'app-sale-invoice-pending',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    ConfirmDialogModule,
    SharedModule,
    CopCentsPipe,
    BillingKindTagComponent,
    SaleInvoicePreviewComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './sale-invoice-pending.component.html',
})
export class SaleInvoicePendingComponent implements OnInit {
  private readonly api = inject(BillingSaleInvoiceApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly counterpartyCatalog = inject(BillingCounterpartyCatalog);

  // Borrador que se muestra en el modal "Vista factura" y su contraparte (cliente o proveedor) completa
  previewInvoice = signal<SaleInvoice | null>(null);
  previewClient = signal<BillingClient | null>(null);

  // true cuando la tabla se muestra dentro del menú de Facturación (sin título de página ni botón volver)
  embedded = input(false);

  drafts = signal<SaleInvoice[]>([]);
  loading = signal(true);
  busy = signal(false);
  kindFilter = signal<DocumentKind | null>(null);
  readonly kindOptions = KIND_FILTER_OPTIONS;
  readonly globalFilterFields = [
    'counterparty',
    'supplierInvoiceNumber',
    'dateText',
    'kindLabel',
    'itemsCount',
    'totalPesos',
    'updatedText',
  ];

  filtered = computed(() => {
    const kind = this.kindFilter();
    return kind ? this.drafts().filter((d) => d.kind === kind) : this.drafts();
  });

  // Filas con campos planos para el buscador y los filtros de columna (p-columnFilter)
  rows = computed<PendingRow[]>(() =>
    this.filtered().map((draft) => {
      const totalCents = this.totalOf(draft);
      return {
        draft,
        counterparty: this.counterpartyOf(draft),
        supplierInvoiceNumber: draft.supplierInvoiceNumber ?? '',
        dateText: isoDateText(draft.date),
        kindLabel: DOCUMENT_KIND_CONFIG[draft.kind].tag,
        itemsCount: draft.lines.length,
        totalPesos: centsToPesos(totalCents),
        totalCents,
        updatedText: isoDateTimeText(draft.updatedAt),
      };
    }),
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listWithSkipped('BORRADOR').subscribe({
      next: ({ items, skipped }) => {
        this.drafts.set(items);
        this.loading.set(false);
        if (skipped > 0) this.messages.add(skippedToast(skipped));
      },
      error: (e) => {
        this.loading.set(false);
        this.toast('error', 'No se pudieron cargar los borradores', this.errorMessage(e));
      },
    });
  }

  totalOf(invoice: SaleInvoice): number {
    return invoiceTotals(invoice).totalCents;
  }

  counterpartyOf(invoice: SaleInvoice): string {
    return invoice.clientName ?? `Sin ${DOCUMENT_KIND_CONFIG[invoice.kind].counterpartyLower}`;
  }

  // Abre la vista de impresión del borrador; el documento del cliente/proveedor se busca en el catálogo
  async openPreview(invoice: SaleInvoice): Promise<void> {
    this.previewClient.set(null);
    this.previewInvoice.set(invoice);
    if (!invoice.clientId) return;
    try {
      const counterparties = await firstValueFrom(this.counterpartyCatalog.getCounterparties(invoice.kind));
      this.previewClient.set(counterparties.find((c) => c.id === invoice.clientId) ?? null);
    } catch {
      // Sin catálogo la vista se muestra igual, sin los datos de la contraparte
    }
  }

  closePreview(): void {
    this.previewInvoice.set(null);
  }

  // `from` deja a la factura saber a qué pantalla volver (el menú o esta misma pantalla)
  continue(invoice: SaleInvoice): void {
    this.router.navigate([DOCUMENT_KIND_CONFIG[invoice.kind].basePath, invoice.id], {
      state: { from: this.embedded() ? '/billing' : '/billing/pending' },
    });
  }

  confirmDuplicate(invoice: SaleInvoice): void {
    if (this.busy()) return;
    this.confirmation.confirm({
      header: 'Duplicar borrador',
      message: `Se creará un nuevo borrador con el mismo ${DOCUMENT_KIND_CONFIG[invoice.kind].counterpartyLower} y los mismos ítems. ¿Continuar?`,
      acceptLabel: 'Duplicar',
      rejectLabel: 'Cancelar',
      accept: () => this.duplicate(invoice),
    });
  }

  confirmDelete(invoice: SaleInvoice): void {
    if (this.busy()) return;
    this.confirmation.confirm({
      header: 'Eliminar borrador',
      icon: 'pi pi-exclamation-triangle',
      message: '¿Seguro que deseas eliminar este borrador? Esta acción no se puede deshacer.',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => this.remove(invoice),
    });
  }

  goBack(): void {
    this.router.navigate(['/billing']);
  }

  // El duplicado es un borrador nuevo (sin id ni número) con fecha de hoy; conserva los valores
  // efectivos de cada línea (precio e IVA editados). Las referencias de catálogo se conservan: así una línea
  // con el precio o el IVA sin editar (`precioEditado` / `ivaEditado` del back) sigue al catálogo en el duplicado
  // (la API vuelve a fijar las referencias).
  // No copia el N.º de factura del proveedor: cada factura de compra tiene el suyo.
  private async duplicate(invoice: SaleInvoice): Promise<void> {
    if (this.busy()) return; // reentrada: N clics => un solo duplicado
    this.busy.set(true);
    try {
      const lines: SaleInvoiceLineInput[] = invoice.lines;
      await firstValueFrom(
        this.api.saveDraft({ kind: invoice.kind, clientId: invoice.clientId, date: todayIso(), lines }),
      );
      this.toast('success', 'Borrador duplicado', 'Se creó un nuevo borrador con los mismos datos.');
      this.load();
    } catch (e) {
      this.toast('error', 'No se pudo duplicar', this.errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async remove(invoice: SaleInvoice): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteDraft(invoice.id, invoice.version)); // la versión de la lista: detecta ediciones ajenas
      this.drafts.update((list) => list.filter((d) => d.id !== invoice.id));
      this.toast('success', 'Borrador eliminado', 'El borrador se eliminó correctamente.');
    } catch (e) {
      this.toast('error', 'No se pudo eliminar', this.errorMessage(e));
      if (isConcurrentModification(e)) this.load(); // otro lo modificó: se recarga la lista con las versiones vigentes
    } finally {
      this.busy.set(false);
    }
  }

  private toast(severity: 'success' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail });
  }

  private errorMessage(e: unknown): string {
    return billingErrorMessage(e); // incluye BILLING_IDEMPOTENCY_CONFLICT (409)
  }
}
