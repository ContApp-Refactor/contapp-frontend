import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BillingLineTax } from '../../models/billing-sale-invoice.model';
import { formatSingleRate, formatTaxLabel } from '../../utils/tax-breakdown';

// Celda "Impuesto %" de una línea: con impuestos de categoría muestra cada uno como "Nombre: 19%", uno debajo del otro
// (sin partir "Nombre: n%" en dos renglones); sin desglose (documento viejo, IVA por defecto o editado) muestra el valor
// único como siempre ("19%" o "—"). Solo presentación: el impuesto de la línea se calcula con la suma (`rate`).
@Component({
  selector: 'app-billing-tax-breakdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (labels().length > 0) {
      <ul class="list-none m-0 p-0 text-right" aria-label="Impuestos de la línea">
        @for (label of labels(); track $index) {
          <li class="whitespace-nowrap leading-tight" data-testid="tax-item">{{ label }}</li>
        }
      </ul>
    } @else {
      <div class="text-right whitespace-nowrap" data-testid="tax-single">{{ single() }}</div>
    }
  `,
})
export class BillingTaxBreakdownComponent {
  readonly taxes = input<BillingLineTax[] | null | undefined>(null);
  readonly rate = input<number | null | undefined>(null);

  readonly labels = computed(() => (this.taxes() ?? []).map(formatTaxLabel));
  readonly single = computed(() => formatSingleRate(this.rate()));
}
