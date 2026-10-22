import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { LocalStorageMethods } from '../../../Shared/Methods/local-storage.method';
import { SaleReturn } from '../../models/billing-sale-return.model';
import { DOCUMENT_KIND_CONFIG } from '../../models/document-kind';
import { CopCentsPipe } from '../../pipes/cop-cents.pipe';
import { calcReturnTotals, returnLineSubtotalCents } from '../../utils/sale-return';
import { BillingStatusBadgeComponent } from '../billing-status-badge/billing-status-badge.component';

// Vista previa de la devolución (nota crédito) tal como se vería impresa. Solo lectura.
@Component({
  selector: 'app-sale-return-preview',
  imports: [DatePipe, CopCentsPipe, BillingStatusBadgeComponent],
  template: `
    <div
      class="relative mx-auto w-full overflow-hidden bg-white text-gray-800 font-family-sans text-sm border border-gray-300 rounded-md shadow-md p-32"
      style="max-width: 800px"
    >
      @if (watermark(); as mark) {
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span
            class="font-bold uppercase"
            [style]="
              'font-size: 120px; letter-spacing: 8px; transform: rotate(-30deg); opacity: 0.08; color: ' +
              (saleReturn().status === 'ANULADA' ? '#b91c1c' : '#374151')
            "
            >{{ mark }}</span
          >
        </div>
      }

      <div class="relative">
        <!-- Encabezado -->
        <div class="flex justify-between items-start gap-16 pb-16 border-b-2 border-gray-300">
          <div>
            <p class="font-bold text-xl text-primary">{{ companyName }}</p>
            @if (companyNit) {
              <p class="text-gray-600 mt-4">NIT: {{ companyNit }}</p>
            }
          </div>
          <div class="text-right">
            <p class="font-bold text-xl tracking-wide">
              @if (ordinal(); as n) {
                {{ cfg().returnPreviewTitle }} N.º {{ n }}
              } @else {
                {{ cfg().returnPreviewTitle }} — BORRADOR
              }
            </p>
            @if (saleReturn().number) {
              <p class="mt-4 font-semibold">{{ cfg().noteName }} {{ saleReturn().number }}</p>
            }
            <p class="mt-4 text-gray-600">Fecha: {{ saleReturn().date | date: 'dd/MM/yyyy' }}</p>
            <div class="mt-8"><app-billing-status-badge [status]="saleReturn().status" /></div>
          </div>
        </div>

        <!-- Factura original -->
        <div class="mt-16 p-12 border border-gray-200 rounded-md">
          <p class="text-xs uppercase text-gray-500 mb-4">{{ cfg().originalInvoiceLabel }}</p>
          <p class="font-semibold">{{ saleReturn().originalNumber ?? '—' }}</p>
          @if (saleReturn().kind === 'PURCHASE') {
            <p class="text-gray-600">N.º factura del proveedor: {{ saleReturn().supplierInvoiceNumber || '—' }}</p>
          }
          <p class="text-gray-600">Fecha: {{ saleReturn().originalDate | date: 'dd/MM/yyyy' }}</p>
          <p class="text-gray-600">{{ cfg().counterparty }}: {{ saleReturn().clientName || '—' }}</p>
        </div>

        <!-- Motivo -->
        <div class="mt-12 p-12 border border-gray-200 rounded-md">
          <p class="text-xs uppercase text-gray-500 mb-4">Motivo</p>
          <p>{{ saleReturn().reason || '—' }}</p>
        </div>

        <!-- Líneas -->
        <table class="w-full mt-16 border-collapse">
          <thead>
            <tr class="bg-gray-100 text-xs uppercase text-gray-600">
              <th class="text-left p-8" style="width: 40px">#</th>
              <th class="text-left p-8">Descripción</th>
              <th class="text-right p-8">Cant. devuelta</th>
              <th class="text-right p-8">Vr. unitario</th>
              <th class="text-right p-8">IVA %</th>
              <th class="text-right p-8">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            @for (line of saleReturn().lines; track $index) {
              <tr class="border-b border-gray-200">
                <td class="p-8">{{ $index + 1 }}</td>
                <td class="p-8">{{ line.productName }}</td>
                <td class="p-8 text-right">{{ line.cantidadDevuelta }}</td>
                <td class="p-8 text-right">{{ line.precioUnitarioCents | copCents }}</td>
                <td class="p-8 text-right">{{ line.ivaPct }}%</td>
                <td class="p-8 text-right font-semibold">{{ lineSubtotal(line) | copCents }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center text-gray-500 p-24">Esta devolución no tiene líneas.</td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Totales -->
        <div class="flex justify-end mt-16">
          <div class="w-full flex flex-col gap-8" style="max-width: 280px">
            <div class="flex justify-between">
              <span class="text-gray-600">Subtotal:</span>
              <span class="font-semibold">{{ totals().subtotalCents | copCents }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">IVA:</span>
              <span class="font-semibold">{{ totals().ivaCents | copCents }}</span>
            </div>
            <div class="flex justify-between items-center p-8 rounded-md bg-gray-100 text-lg">
              <span class="font-bold text-primary">TOTAL:</span>
              <span class="font-extrabold text-primary">{{ totals().totalCents | copCents }}</span>
            </div>
          </div>
        </div>

        <p class="mt-32 pt-12 border-t border-gray-200 text-center text-xs text-gray-500">
          @switch (saleReturn().status) {
            @case ('BORRADOR') {
              Documento de vista previa — no tiene validez como {{ cfg().noteShort }}.
            }
            @case ('ANULADA') {
              Devolución anulada.
            }
            @default {
              {{ noteShortCapitalized() }} generada por devolución de mercancía.
            }
          }
        </p>
      </div>
    </div>
  `,
})
export class SaleReturnPreviewComponent {
  saleReturn = input.required<SaleReturn>();
  /** Ordinal dentro de la factura (null en borradores) */
  ordinal = input<number | null>(null);

  private readonly storage = inject(LocalStorageMethods);
  private readonly enterprise = this.storage.loadEnterpriseData();
  readonly companyName = this.enterprise?.name || 'Empresa';
  readonly companyNit = this.enterprise?.nit || '';

  cfg = computed(() => DOCUMENT_KIND_CONFIG[this.saleReturn().kind]);
  noteShortCapitalized = computed(() => {
    const note = this.cfg().noteShort;
    return note.charAt(0).toUpperCase() + note.slice(1);
  });
  totals = computed(() => calcReturnTotals(this.saleReturn().lines));
  watermark = computed(() => {
    const s = this.saleReturn().status;
    return s === 'BORRADOR' ? 'Borrador' : s === 'ANULADA' ? 'Anulada' : null;
  });

  lineSubtotal = returnLineSubtotalCents;
}
