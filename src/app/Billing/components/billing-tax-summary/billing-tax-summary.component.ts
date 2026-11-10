import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { TaxSummaryRow } from '../../utils/money';

export type { TaxSummaryRow };

// Pie de la factura: a la izquierda la tabla "Detalle de impuestos" (Nombre | Base | Total) y a la derecha los
// totales (Subtotal, un renglón por impuesto y TOTAL). Es presentacional: las filas las calcula `taxSummaryRows`
// (utils/money) y llegan por input. Sin filas (sin impuestos) la tabla muestra "Sin impuestos" y el bloque derecho
// cae al renglón único "Impuesto:" con el total de impuestos del documento.
@Component({
  selector: 'app-billing-tax-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopCentsPipe],
  template: `
    <div class="flex flex-col md:flex-row md:justify-between gap-24 mt-20" data-testid="tax-summary">
      <!-- Detalle de impuestos -->
      <section class="w-full md:w-1/2 text-sm" aria-label="Detalle de impuestos">
        <h4 class="font-bold text-primary mb-8">Detalle de impuestos</h4>
        <table class="w-full border-collapse">
          <thead>
            <tr [class]="headClass()">
              <th class="text-left py-6 pr-8 font-semibold">Nombre</th>
              <th class="text-right py-6 px-8 font-semibold">Base</th>
              <th class="text-right py-6 pl-8 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track $index) {
              <tr class="border-b border-gray-200" data-testid="tax-summary-row">
                <td class="py-6 pr-8">{{ row.name }}</td>
                <td class="py-6 px-8 text-right">{{ row.baseCents | copCents }}</td>
                <td class="py-6 pl-8 text-right font-semibold">{{ row.taxCents | copCents }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="3" class="py-12 text-center text-gray-500" data-testid="tax-summary-empty">Sin impuestos</td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <!-- Totales -->
      <div class="w-full md:w-1/3 text-sm">
        <div class="flex flex-col gap-12">
          <div class="flex justify-between">
            <span [class]="labelClass()">Subtotal:</span>
            <span class="font-semibold" data-testid="summary-subtotal">{{ subtotalCents() | copCents }}</span>
          </div>
          @for (row of rows(); track $index) {
            <div class="flex justify-between">
              <span [class]="labelClass()">{{ row.name }}:</span>
              <span class="font-semibold">{{ row.taxCents | copCents }}</span>
            </div>
          } @empty {
            <div class="flex justify-between">
              <span [class]="labelClass()">Impuesto:</span>
              <span class="font-semibold" data-testid="summary-tax">{{ taxCents() | copCents }}</span>
            </div>
          }
          @if (variant() === 'print') {
            <div class="flex justify-between items-center p-8 rounded-md bg-gray-100 text-lg">
              <span class="font-bold text-primary">TOTAL:</span>
              <span class="font-extrabold text-primary" data-testid="summary-total">{{ totalCents() | copCents }}</span>
            </div>
          } @else {
            <hr />
            <div class="flex justify-between text-xl">
              <span class="font-bold text-primary">TOTAL:</span>
              <span class="font-extrabold text-primary" data-testid="summary-total">{{ totalCents() | copCents }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class BillingTaxSummaryComponent {
  readonly rows = input<TaxSummaryRow[]>([]);
  readonly subtotalCents = input.required<number>();
  readonly taxCents = input<number>(0); // total de impuestos; solo se muestra mientras no haya `rows`
  readonly totalCents = input.required<number>();
  // 'form' (pantalla de edición/consulta) o 'print' (vista previa impresa: TOTAL en recuadro gris)
  readonly variant = input<'form' | 'print'>('form');

  readonly labelClass = computed(() => (this.variant() === 'print' ? 'text-gray-600' : 'text-gray-700'));
  readonly headClass = computed(() =>
    this.variant() === 'print'
      ? 'text-xs uppercase text-gray-600 bg-gray-100'
      : 'text-xs uppercase text-gray-500 border-b border-gray-300',
  );
}
