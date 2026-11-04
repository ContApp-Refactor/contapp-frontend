import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { InvoiceWithReturnsSummary } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind, KIND_FILTER_OPTIONS } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { isoDateText } from '../../utils/format';
import { centsToPesos } from '../../utils/money';
import { RETURN_STATE_LABEL } from '../../utils/sale-return';
import { BillingKindTagComponent } from '../billing-kind-tag/billing-kind-tag.component';

// Fila de la tabla: campos planos para que los filtros de columna (p-columnFilter) puedan leerlos
interface ReturnListRow {
  summary: InvoiceWithReturnsSummary;
  invoiceText: string; // número de la factura + N.º de factura del proveedor (compras)
  counterparty: string;
  dateText: string;
  kindLabel: string;
  stateLabel: string;
  invoiceTotalPesos: number;
  returnedTotalPesos: number;
}

// Facturas (de venta y de compra) con al menos una devolución emitida
@Component({
  selector: 'app-sale-return-list',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    CopCentsPipe,
    BillingKindTagComponent,
  ],
  templateUrl: './sale-return-list.component.html',
})
export class SaleReturnListComponent implements OnInit {
  private readonly api = inject(BillingSaleReturnApi);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  list = signal<InvoiceWithReturnsSummary[]>([]);
  loading = signal(true);
  kindFilter = signal<DocumentKind | null>(null);
  readonly kindOptions = KIND_FILTER_OPTIONS;
  readonly globalFilterFields = [
    'invoiceText',
    'counterparty',
    'dateText',
    'kindLabel',
    'stateLabel',
    'invoiceTotalPesos',
    'returnedTotalPesos',
  ];

  // Opciones del filtro de la columna "Estado devolución"
  readonly stateOptions = [
    { label: 'Todos', value: null },
    ...Object.values(RETURN_STATE_LABEL)
      .filter((label) => label !== RETURN_STATE_LABEL.SIN_DEVOLUCION)
      .map((label) => ({ label, value: label })),
  ];

  rows = computed<ReturnListRow[]>(() => {
    const kind = this.kindFilter();
    return this.list()
      .filter((r) => !kind || r.kind === kind)
      .map((summary) => ({
        summary,
        invoiceText: [summary.invoiceNumber, summary.supplierInvoiceNumber].filter(Boolean).join(' '),
        counterparty: this.counterpartyOf(summary),
        dateText: isoDateText(summary.invoiceDate),
        kindLabel: DOCUMENT_KIND_CONFIG[summary.kind].tag,
        stateLabel: RETURN_STATE_LABEL[summary.state],
        invoiceTotalPesos: centsToPesos(summary.invoiceTotalCents),
        returnedTotalPesos: centsToPesos(summary.returnedTotalCents),
      }));
  });

  ngOnInit(): void {
    this.api.listInvoicesWithReturns().subscribe({
      next: (rows) => {
        this.list.set(rows);
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
    this.router.navigate([DOCUMENT_KIND_CONFIG[row.kind].basePath, row.invoiceId], {
      state: { from: '/billing/returns' },
    });
  }

  goBack(): void {
    this.router.navigate(['/billing']);
  }
}
