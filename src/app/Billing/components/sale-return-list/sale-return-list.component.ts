import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { InvoiceWithReturnsSummary } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind, KIND_FILTER_OPTIONS } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { RETURN_STATE_LABEL } from '../../utils/sale-return';
import { BillingKindTagComponent } from '../billing-kind-tag/billing-kind-tag.component';

// Facturas (de venta y de compra) con al menos una devolución emitida
@Component({
  selector: 'app-sale-return-list',
  imports: [DatePipe, FormsModule, ButtonModule, DropdownModule, TableModule, CopCentsPipe, BillingKindTagComponent],
  templateUrl: './sale-return-list.component.html',
})
export class SaleReturnListComponent implements OnInit {
  private readonly api = inject(BillingSaleReturnApi);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  rows = signal<InvoiceWithReturnsSummary[]>([]);
  loading = signal(true);
  kindFilter = signal<DocumentKind | null>(null);
  readonly kindOptions = KIND_FILTER_OPTIONS;

  filtered = computed(() => {
    const kind = this.kindFilter();
    return kind ? this.rows().filter((r) => r.kind === kind) : this.rows();
  });

  // Tipado como Record<string, string>: en la plantilla `row` llega como `any` y no puede indexar un Record con clave restringida
  readonly stateLabel: Record<string, string> = RETURN_STATE_LABEL;

  ngOnInit(): void {
    this.api.listInvoicesWithReturns().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el listado.' });
      },
    });
  }

  counterpartyOf(row: InvoiceWithReturnsSummary): string {
    return row.clientName ?? `Sin ${DOCUMENT_KIND_CONFIG[row.kind].counterpartyLower}`;
  }

  // El detalle de las devoluciones está en la sección "Devoluciones" de la factura original
  view(row: InvoiceWithReturnsSummary): void {
    this.router.navigate([DOCUMENT_KIND_CONFIG[row.kind].basePath, row.invoiceId]);
  }

  goBack(): void {
    this.router.navigate(['/billing']);
  }
}
