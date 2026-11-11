import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { BillingQrComponent } from '../billing-qr/billing-qr.component';
import { TaxSummaryRow, WithholdingRow, withholdingRowName } from '../../utils/money';

export type { TaxSummaryRow };

// Pie de la factura: a la izquierda la tabla "Detalle de impuestos" (Nombre | Base | Total) y a la derecha los
// totales (Subtotal, un renglón por impuesto y TOTAL). Es presentacional: las filas las calcula `taxSummaryRows`
// (utils/money) y llegan por input. Sin filas (sin impuestos) la tabla muestra "Sin impuestos" y el bloque derecho
// cae al renglón único "Impuesto:" con el total de impuestos del documento.
@Component({
  selector: 'app-billing-tax-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopCentsPipe, BillingQrComponent],
  template: `
    <div [class]="rootClass()" data-testid="tax-summary">
      <!-- Detalle de impuestos -->
      @if (part() !== 'totals') {
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
        <!-- QR de verificación (solo hoja emitida/anulada con código) o recuadro del borrador -->
        @if (verificationCode(); as code) {
          <div class="mt-16 flex flex-col items-start gap-4" data-testid="verification-qr">
            <app-billing-qr [value]="code" [size]="104" />
            <span class="text-gray-500 break-all" style="font-size: 9px; max-width: 220px">{{ code }}</span>
          </div>
        } @else if (qrPlaceholder()) {
          <div
            class="mt-16 flex items-center justify-center text-center text-gray-500 border border-dashed border-gray-300 bg-gray-50"
            style="width: 104px; height: 104px; font-size: 10px"
            data-testid="verification-qr-placeholder"
          >
            El QR se genera al emitir
          </div>
        }
      </section>
      }

      <!-- Totales -->
      @if (part() !== 'taxes') {
      <div [class]="part() === 'totals' ? 'w-full text-sm' : 'w-full md:w-1/3 text-sm'">
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
          @for (w of withholdings(); track w.code) {
            <div class="flex justify-between" data-testid="withholding-row">
              <span [class]="labelClass()">{{ nameOf(w) }}:</span>
              <span class="font-semibold" data-testid="withholding-amount">-{{ w.amountCents | copCents }}</span>
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
      }
    </div>
  `,
})
export class BillingTaxSummaryComponent {
  readonly rows = input<TaxSummaryRow[]>([]);
  readonly subtotalCents = input.required<number>();
  readonly taxCents = input<number>(0); // total de impuestos; solo se muestra mientras no haya `rows`
  readonly totalCents = input.required<number>(); // NETO: ya descuenta las retenciones
  readonly withholdings = input<WithholdingRow[]>([]); // una línea por retención, con signo menos
  readonly nameOf = withholdingRowName;
  // 'form' (pantalla de edición/consulta) o 'print' (vista previa impresa: TOTAL en recuadro gris)
  readonly variant = input<'form' | 'print'>('form');
  // 'all' (impuestos + totales, como la vista previa) | 'totals' (solo el resumen) | 'taxes' (solo "Detalle de impuestos").
  // El formulario usa 'totals' junto a la tabla de productos y 'taxes' debajo.
  readonly part = input<'all' | 'totals' | 'taxes'>('all');

  // Código de verificación (string opaco) que codifica el QR bajo "Detalle de impuestos"; vacío = no se muestra QR
  readonly verificationCode = input<string | null | undefined>(null);
  // Borrador: en lugar del QR se muestra un recuadro "El QR se genera al emitir"
  readonly qrPlaceholder = input<boolean>(false);

  readonly rootClass = computed(() =>
    this.part() === 'all' ? 'flex flex-col md:flex-row md:justify-between gap-24 mt-20' : 'flex flex-col',
  );

  readonly labelClass = computed(() => (this.variant() === 'print' ? 'text-gray-600' : 'text-gray-700'));
  readonly headClass = computed(() =>
    this.variant() === 'print'
      ? 'text-xs uppercase text-gray-600 bg-gray-100'
      : 'text-xs uppercase text-gray-500 border-b border-gray-300',
  );
}
