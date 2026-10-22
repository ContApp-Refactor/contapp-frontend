import { Component, computed, input } from '@angular/core';
import { DOCUMENT_KIND_CONFIG, DocumentKind } from '../../models/document-kind';

const KIND_CLASSES: Record<DocumentKind, string> = {
  SALE: 'bg-blue-100 text-blue-800',
  PURCHASE: 'bg-purple-100 text-purple-800',
};

// Etiqueta "Venta" / "Compra" para los listados que mezclan ambos tipos
@Component({
  selector: 'app-billing-kind-tag',
  template: `<span
    class="inline-block px-12 py-4 rounded-full text-xs font-semibold font-family-sans {{ classes() }}"
    >{{ label() }}</span
  >`,
})
export class BillingKindTagComponent {
  kind = input.required<DocumentKind>();
  label = computed(() => DOCUMENT_KIND_CONFIG[this.kind()].tag);
  classes = computed(() => KIND_CLASSES[this.kind()]);
}
