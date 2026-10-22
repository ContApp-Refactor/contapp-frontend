import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService, SharedModule } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { SaleInvoice, SaleInvoiceLineInput } from '../../models/billing-sale-invoice.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind, KIND_FILTER_OPTIONS } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { calcTotals } from '../../utils/money';
import { BillingKindTagComponent } from '../billing-kind-tag/billing-kind-tag.component';

const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Lista los borradores de venta y de compra para retomarlos, duplicarlos o eliminarlos
@Component({
  selector: 'app-sale-invoice-pending',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DropdownModule,
    TableModule,
    ConfirmDialogModule,
    SharedModule,
    CopCentsPipe,
    BillingKindTagComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './sale-invoice-pending.component.html',
})
export class SaleInvoicePendingComponent implements OnInit {
  private readonly api = inject(BillingSaleInvoiceApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  drafts = signal<SaleInvoice[]>([]);
  loading = signal(true);
  busy = signal(false);
  kindFilter = signal<DocumentKind | null>(null);
  readonly kindOptions = KIND_FILTER_OPTIONS;

  filtered = computed(() => {
    const kind = this.kindFilter();
    return kind ? this.drafts().filter((d) => d.kind === kind) : this.drafts();
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.list('BORRADOR').subscribe((drafts) => {
      this.drafts.set(drafts);
      this.loading.set(false);
    });
  }

  totalOf(invoice: SaleInvoice): number {
    return calcTotals(invoice.lines).totalCents;
  }

  counterpartyOf(invoice: SaleInvoice): string {
    return invoice.clientName ?? `Sin ${DOCUMENT_KIND_CONFIG[invoice.kind].counterpartyLower}`;
  }

  continue(invoice: SaleInvoice): void {
    this.router.navigate([DOCUMENT_KIND_CONFIG[invoice.kind].basePath, invoice.id]);
  }

  confirmDuplicate(invoice: SaleInvoice): void {
    this.confirmation.confirm({
      header: 'Duplicar borrador',
      message: `Se creará un nuevo borrador con el mismo ${DOCUMENT_KIND_CONFIG[invoice.kind].counterpartyLower} y las mismas líneas. ¿Continuar?`,
      acceptLabel: 'Duplicar',
      rejectLabel: 'Cancelar',
      accept: () => this.duplicate(invoice),
    });
  }

  confirmDelete(invoice: SaleInvoice): void {
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
  // efectivos de cada línea (precio e IVA editados). Las referencias de catálogo las vuelve a fijar la API.
  // No copia el N.º de factura del proveedor: cada factura de compra tiene el suyo.
  private async duplicate(invoice: SaleInvoice): Promise<void> {
    this.busy.set(true);
    try {
      const lines: SaleInvoiceLineInput[] = invoice.lines.map(
        ({ precioCatalogoCents, ivaCatalogoPct, ...line }) => line,
      );
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
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteDraft(invoice.id));
      this.drafts.update((list) => list.filter((d) => d.id !== invoice.id));
      this.toast('success', 'Borrador eliminado', 'El borrador se eliminó correctamente.');
    } catch (e) {
      this.toast('error', 'No se pudo eliminar', this.errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private toast(severity: 'success' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail });
  }

  private errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
  }
}
