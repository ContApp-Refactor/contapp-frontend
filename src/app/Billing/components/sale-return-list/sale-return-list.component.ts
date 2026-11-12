import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { InvoiceWithReturnsSummary } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { isoDateText } from '../../utils/format';
import { kindFromRoute } from '../../utils/route-kind';
import { centsToPesos } from '../../utils/money';
import { RETURN_STATE_LABEL } from '../../utils/sale-return';

// Fila de la tabla: campos planos para el filtro global
interface ReturnListRow {
  summary: InvoiceWithReturnsSummary;
  invoiceText: string; // número de la factura + N.º de factura del proveedor (compras)
  counterparty: string;
  dateText: string;
  stateLabel: string;
  invoiceTotalPesos: number;
  returnedTotalPesos: number;
}

// Facturas de un tipo (venta o compra, según `data.kind` de la ruta) con al menos una devolución emitida
@Component({
  selector: 'app-sale-return-list',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    CopCentsPipe,
  ],
  templateUrl: './sale-return-list.component.html',
})
export class SaleReturnListComponent implements OnInit {
  private readonly api = inject(BillingSaleReturnApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly kind: DocumentKind = kindFromRoute(this.route);
  readonly cfg = DOCUMENT_KIND_CONFIG[this.kind];
  private readonly messages = inject(MessageService);

  list = signal<InvoiceWithReturnsSummary[]>([]);
  loading = signal(true);
  readonly globalFilterFields = [
    'invoiceText',
    'counterparty',
    'dateText',
    'stateLabel',
    'invoiceTotalPesos',
    'returnedTotalPesos',
  ];

  rows = computed<ReturnListRow[]>(() => {
    return this.list()
      .filter((r) => r.kind === this.kind)
      .map((summary) => ({
        summary,
        invoiceText: [summary.invoiceNumber, summary.supplierInvoiceNumber].filter(Boolean).join(' '),
        counterparty: this.counterpartyOf(summary),
        dateText: isoDateText(summary.invoiceDate),
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
      state: { from: `${this.cfg.basePath}/returns` },
    });
  }

  goBack(): void {
    this.router.navigate([this.cfg.basePath]);
  }
}
