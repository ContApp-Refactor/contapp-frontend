import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { INVOICE_STATUS_LABEL, InvoiceStatus, SaleInvoice } from '../../models/billing-sale-invoice.model';
import { DOCUMENT_KIND_CONFIG, DocumentKind, KIND_FILTER_OPTIONS } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingSaleInvoiceApi } from '../../services/billing-sale-invoice.api';
import { BillingSaleReturnApi } from '../../services/billing-sale-return.api';
import { billingErrorMessage, skippedToast } from '../../utils/billing-error';
import { isoDateText } from '../../utils/format';
import { NothingToReturnError, returnWholeInvoice } from '../../utils/full-return';
import { centsToPesos, invoiceTotals } from '../../utils/money';
import { RETURNED_INVOICE_LABEL } from '../../utils/sale-return';
import { BillingKindTagComponent } from '../billing-kind-tag/billing-kind-tag.component';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';

// Fila de la tabla: campos planos para que los filtros de columna (p-columnFilter) puedan leerlos
interface InvoiceRow {
  invoice: SaleInvoice;
  numberText: string; // número + N.º de factura del proveedor (compras)
  counterparty: string;
  dateText: string;
  kindLabel: string;
  statusLabel: string;
  returnLabel: string; // "Devuelta" / "Devuelta parcialmente" (vacío si no tiene devoluciones)
  totalPesos: number;
  totalCents: number;
}

// Listado de facturas de venta y de compra (filtro por estado y por tipo, buscador y filtro por columna)
@Component({
  selector: 'app-sale-invoice-list',
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
    CopCentsPipe,
    BillingKindTagComponent,
    BillingStatusBadgeComponent,
  ],
  templateUrl: './sale-invoice-list.component.html',
})
export class SaleInvoiceListComponent implements OnInit {
  private readonly api = inject(BillingSaleInvoiceApi);
  private readonly returnApi = inject(BillingSaleReturnApi);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  invoices = signal<SaleInvoice[]>([]);
  loading = signal(true);
  statusFilter = signal<InvoiceStatus | null>(null);
  returnFilter = signal<string | null>(null); // filtro por estado de devolución (se aplica con dt.filter)
  kindFilter = signal<DocumentKind | null>(null);
  readonly kindOptions = KIND_FILTER_OPTIONS;
  readonly globalFilterFields = [
    'numberText',
    'counterparty',
    'dateText',
    'kindLabel',
    'statusLabel',
    'returnLabel',
    'totalPesos',
  ];

  // Opciones del filtro de la columna "Estado" por estado de devolución
  readonly returnOptions = [
    { label: 'Todas', value: null },
    { label: RETURNED_INVOICE_LABEL.PARCIAL!, value: RETURNED_INVOICE_LABEL.PARCIAL! },
    { label: RETURNED_INVOICE_LABEL.TOTAL!, value: RETURNED_INVOICE_LABEL.TOTAL! },
  ];

  readonly statusOptions = [
    { label: 'Todos los estados', value: null },
    ...(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => ({
      label: INVOICE_STATUS_LABEL[s],
      value: s,
    })),
  ];

  filtered = computed(() => {
    const status = this.statusFilter();
    const kind = this.kindFilter();
    return this.invoices().filter((i) => (!status || i.status === status) && (!kind || i.kind === kind));
  });

  rows = computed<InvoiceRow[]>(() =>
    this.filtered().map((invoice) => {
      const totalCents = this.totalOf(invoice);
      return {
        invoice,
        numberText: [invoice.number, invoice.supplierInvoiceNumber].filter(Boolean).join(' '),
        counterparty: this.counterpartyOf(invoice),
        dateText: isoDateText(invoice.date),
        kindLabel: DOCUMENT_KIND_CONFIG[invoice.kind].tag,
        statusLabel: INVOICE_STATUS_LABEL[invoice.status],
        returnLabel: invoice.returnStatus ? (RETURNED_INVOICE_LABEL[invoice.returnStatus] ?? '') : '',
        totalPesos: centsToPesos(totalCents),
        totalCents,
      };
    }),
  );

  // Diálogo de devolución completa (reemplaza a la antigua "anulación": anular = devolver toda la factura)
  returnTarget = signal<SaleInvoice | null>(null);
  returnReason = '';
  returning = signal(false);

  ngOnInit(): void {
    this.load();
  }

  // En facturas emitidas/anuladas mandan los totales del back; en borrador se calculan con las líneas
  totalOf(invoice: SaleInvoice): number {
    return invoiceTotals(invoice).totalCents;
  }

  counterpartyOf(invoice: SaleInvoice): string {
    return invoice.clientName ?? `Sin ${DOCUMENT_KIND_CONFIG[invoice.kind].counterpartyLower}`;
  }

  noteNameOf(invoice: SaleInvoice): string {
    return DOCUMENT_KIND_CONFIG[invoice.kind].noteName.toLowerCase();
  }

  // `from` deja a la factura saber a qué pantalla volver
  view(invoice: SaleInvoice): void {
    this.router.navigate([DOCUMENT_KIND_CONFIG[invoice.kind].basePath, invoice.id], {
      state: { from: '/billing/list' },
    });
  }

  goBack(): void {
    this.router.navigate(['/billing']);
  }

  openReturn(invoice: SaleInvoice): void {
    this.returnReason = '';
    this.returnTarget.set(invoice);
  }

  closeReturn(): void {
    this.returnTarget.set(null);
  }

  async confirmReturn(): Promise<void> {
    if (this.returning()) return; // reentrada: N clics => una sola devolución
    const target = this.returnTarget();
    if (!target) return;
    if (!this.returnReason.trim()) {
      this.messages.add({ severity: 'warn', summary: 'Motivo requerido', detail: 'Indica el motivo de la devolución.' });
      return;
    }
    this.returning.set(true);
    try {
      const emitted = await returnWholeInvoice(this.returnApi, target.id, this.returnReason);
      this.messages.add({
        severity: 'success',
        summary: 'Factura devuelta',
        detail: `${target.number} fue devuelta por completo (${emitted.number}).`,
      });
      this.closeReturn();
      this.load();
    } catch (e) {
      if (e instanceof NothingToReturnError) {
        this.messages.add({ severity: 'warn', summary: 'Sin cantidades disponibles', detail: e.message });
        this.closeReturn();
        this.load(); // la lista refleja lo que ya devolvió otro (oculta "Devolver factura completa")
        return;
      }
      this.messages.add({ severity: 'error', summary: 'No se pudo devolver', detail: billingErrorMessage(e) });
      // El servidor pudo confirmar la devolución aunque la respuesta falló: se recarga el estado real
      this.load();
    } finally {
      this.returning.set(false);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.api.listWithSkipped().subscribe({
      next: ({ items, skipped }) => {
        this.invoices.set(items);
        this.loading.set(false);
        if (skipped > 0) this.messages.add(skippedToast(skipped));
      },
      error: (e) => {
        this.loading.set(false);
        this.messages.add({ severity: 'error', summary: 'No se pudieron cargar las facturas', detail: billingErrorMessage(e) });
      },
    });
  }
}
