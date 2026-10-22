import { Component, computed, input } from '@angular/core';
import { INVOICE_STATUS_LABEL, InvoiceStatus } from '../../models/billing-sale-invoice.model';

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  BORRADOR: 'bg-gray-200 text-gray-700',
  EMITIDA: 'bg-green-100 text-green-800',
  ANULADA: 'bg-red-100 text-red-800',
};

@Component({
  selector: 'app-billing-status-badge',
  template: `<span
    class="inline-block px-12 py-4 rounded-full text-xs font-semibold font-family-sans {{ classes() }}"
    >{{ label() }}</span
  >`,
})
export class BillingStatusBadgeComponent {
  status = input.required<InvoiceStatus>();
  label = computed(() => INVOICE_STATUS_LABEL[this.status()]);
  classes = computed(() => STATUS_CLASSES[this.status()]);
}
